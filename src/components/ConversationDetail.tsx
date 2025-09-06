'use client';

import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/hooks/useMessages";
// import { useConversations } from "@/hooks/useConversations";
import { encryptMessage, getPrivateKey, decryptMessage } from "@/lib/crypto";
import { formatMessageTime } from "@/lib/dateUtils";
import { useCallback, useEffect, useRef, useState } from "react";

interface FileAttachment {
  fileName: string;
  url: string;
}

function parseMessageWithAttachment(content: string): { text: string; attachment: FileAttachment | null } {
  const attachmentRegex = /\(([^)]+)\)\[([^\]]+)\]/;
  const match = content.match(attachmentRegex);
  
  if (match) {
    const fileName = match[1];
    const url = match[2];
    const text = content.replace(attachmentRegex, '').trim();
    
    return {
      text,
      attachment: { fileName, url }
    };
  }
  
  return {
    text: content,
    attachment: null
  };
}

interface FileAttachmentComponentProps {
  attachment: FileAttachment;
  isReceived: boolean;
  isLastUserMessage?: boolean;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
}

function FileAttachmentComponent({ 
  attachment, 
  isReceived, 
  isLastUserMessage,
  onEditClick, 
  onDeleteClick
}: FileAttachmentComponentProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ horizontal: 'right' | 'left', vertical: 'top' | 'bottom' }>({ horizontal: 'right', vertical: 'bottom' });
  const menuRef = useRef<HTMLDivElement>(null);
  const attachmentRef = useRef<HTMLDivElement>(null);
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(attachment.fileName);
  
  const handleDownload = () => {
    window.open(attachment.url, '_blank');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const toggleMenu = () => {
    if (!showMenu && menuRef.current && attachmentRef.current) {
      const messageContainer = attachmentRef.current.closest('[style*="flex-direction: column-reverse"]') as HTMLElement;
      
      const menuElement = menuRef.current;
      const menuRect = menuElement.getBoundingClientRect();
      const containerRect = messageContainer?.getBoundingClientRect();
      
      const menuWidth = 128;
      const menuHeight = 80;
      const screenWidth = window.innerWidth;
      const padding = 16;
      
      let horizontal: 'right' | 'left' = 'right';
      if (menuRect.right + menuWidth > screenWidth - padding) {
        if (menuRect.left - menuWidth >= padding) {
          horizontal = 'left';
        }
      }
      
      let vertical: 'top' | 'bottom' = 'bottom';
      
      // Special case: if this is the last message sent by the user, position menu at top
      if (!isReceived && isLastUserMessage) {
        vertical = 'top';
      } else if (containerRect) {
        const messageTop = menuRect.top;
        const containerTop = containerRect.top;
        const containerHeight = containerRect.height;
        const messagePositionInContainer = (messageTop - containerTop) / containerHeight;
        
        if (messagePositionInContainer > 0.5) {
          vertical = 'top';
        }
      }
      
      setMenuPosition({ horizontal, vertical });
    }
    setShowMenu(!showMenu);
  };

  if (isImage) {
    return (
      <div ref={attachmentRef} className={`mt-1 flex items-start ${isReceived ? 'justify-start' : 'justify-end'} group`}>
        {/* Three-dot menu for sent messages with attachments */}
        {!isReceived && (onEditClick || onDeleteClick) && (
          <div className="flex items-start pt-2 pr-2 relative" ref={menuRef}>
            <button
              onClick={toggleMenu}
              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {showMenu && (
              <div className={`absolute ${menuPosition.horizontal === 'right' ? 'right-0' : 'left-0'} ${menuPosition.vertical === 'bottom' ? 'top-10' : 'bottom-10'} w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10`}>
                {onEditClick && (
                  <button
                    onClick={() => {
                      onEditClick();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit</span>
                  </button>
                )}
                {onDeleteClick && (
                  <button
                    onClick={() => {
                      onDeleteClick();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="max-w-xs lg:max-w-md rounded-lg overflow-hidden">
          <img 
            src={attachment.url} 
            alt={attachment.fileName}
            className="w-full h-auto max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={handleDownload}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <div className="hidden bg-gray-100 dark:bg-gray-600 p-3 rounded-lg border">
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {attachment.fileName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Image file</p>
              </div>
              <button
                onClick={handleDownload}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded"
              >
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={attachmentRef} className={`mt-1 flex items-start ${isReceived ? 'justify-start' : 'justify-end'} group`}>
      {/* Three-dot menu for sent messages with attachments */}
      {!isReceived && (onEditClick || onDeleteClick) && (
        <div className="flex items-start pt-2 pr-2 relative" ref={menuRef}>
          <button
            onClick={toggleMenu}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          
          {showMenu && (
            <div className={`absolute ${menuPosition.horizontal === 'right' ? 'right-0' : 'left-0'} ${menuPosition.vertical === 'bottom' ? 'top-10' : 'bottom-10'} w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10`}>
              {onEditClick && (
                <button
                  onClick={() => {
                    onEditClick();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </button>
              )}
              {onDeleteClick && (
                <button
                  onClick={() => {
                    onDeleteClick();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-100 dark:bg-gray-600 p-3 rounded-2xl max-w-xs lg:max-w-md">
        <div className="flex items-center space-x-3">
          <svg className="w-8 h-8 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {attachment.fileName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">File attachment</p>
          </div>
          <button
            onClick={handleDownload}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-500 rounded"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export interface Msg {
  id: string
  created_at: string | Date
  updated_at: string | Date
  conversation_id: string
  sender_id: string
  content: string
  type: string
  status: string
  batch_id?: number
}

interface DecryptedMessageProps {
  message: Msg;
  encryptionKey: string | null;
  isReceived: boolean;
  isLastUserMessage?: boolean;
  onEditClick?: (message: Msg, decryptedContent: string) => void;
  onDeleteClick?: (message: Msg) => void;
}

function DecryptedMessage({ message, encryptionKey, isReceived, isLastUserMessage, onEditClick, onDeleteClick }: DecryptedMessageProps) {
  const [decryptedContent, setDecryptedContent] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ horizontal: 'right' | 'left', vertical: 'top' | 'bottom' }>({ horizontal: 'right', vertical: 'bottom' });
  const menuRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  
  const { text, attachment } = parseMessageWithAttachment(decryptedContent);
  const isImage = attachment && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(attachment.fileName);
  const isImageOnly = isImage && !text.trim();

  useEffect(() => {
    const decrypt = async () => {
      if (!encryptionKey) {
        setDecryptedContent('[Unable to decrypt - private key not loaded]');
        setIsDecrypting(false);
        return;
      }

      try {
        const decrypted = await decryptMessage(message.content, encryptionKey);
        setDecryptedContent(decrypted);
      } catch (error) {
        console.error('Decryption failed:', error);
        setDecryptedContent('[Decryption failed]');
      } finally {
        setIsDecrypting(false);
      }
    };

    decrypt();
  }, [message, encryptionKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  if (isDecrypting) {
    return (
      <div className={`mt-2 flex ${isReceived ? 'justify-start' : 'justify-end'}`}>
        <div className={`max-w-xs lg:max-w-md ${
          isReceived ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white' : 'bg-blue-500 text-white'
        } rounded-2xl px-4 py-2 shadow-sm`}>
          <p className="text-sm italic">Decrypting...</p>
        </div>
      </div>
    );
  }

  const handleEditClick = () => {
    if (onEditClick) {
      onEditClick(message, decryptedContent);
    }
    setShowMenu(false);
  };

  const handleDeleteClick = () => {
    if (onDeleteClick) {
      onDeleteClick(message);
    }
    setShowMenu(false);
  };

  const toggleMenu = () => {
    if (!showMenu && menuRef.current && messageRef.current) {
      // Get message container (the scrollable area)
      const messageContainer = messageRef.current.closest('[style*="flex-direction: column-reverse"]') as HTMLElement;
      
      const menuElement = menuRef.current;
      const menuRect = menuElement.getBoundingClientRect();
      const containerRect = messageContainer?.getBoundingClientRect();
      
      const menuWidth = 128; // w-32 = 128px
      const menuHeight = 80; // Approximate menu height
      const screenWidth = window.innerWidth;
      const padding = 16; // Some padding from screen edge
      
      // Calculate horizontal position
      let horizontal: 'right' | 'left' = 'right';
      if (menuRect.right + menuWidth > screenWidth - padding) {
        // Check if positioning to the left would still keep menu on screen
        if (menuRect.left - menuWidth >= padding) {
          horizontal = 'left';
        }
        // If both left and right would overflow, keep it right (better UX)
      }
      
      // Calculate vertical position
      let vertical: 'top' | 'bottom' = 'bottom';
      
      // Special case: if this is the last message sent by the user, position menu at top
      if (!isReceived && isLastUserMessage) {
        vertical = 'top';
      } else if (containerRect) {
        const messageTop = menuRect.top;
        const containerTop = containerRect.top;
        const containerHeight = containerRect.height;
        const messagePositionInContainer = (messageTop - containerTop) / containerHeight;
        
        // If message is in upper half of container, show menu below (bottom)
        // If message is in lower half of container, show menu above (top)
        if (messagePositionInContainer > 0.5) {
          vertical = 'top';
        }
      }
      
      setMenuPosition({ horizontal, vertical });
    }
    setShowMenu(!showMenu);
  };

  // Handle image-only messages without bubble
  // The code below is not used, will be deleted later
  if (isImageOnly) {
    return (
      <div ref={messageRef} className={`mt-2 flex items-start ${isReceived ? 'justify-start' : 'justify-end'} group`}>
        <span>IMAGE ONLY IMAGE ONLY</span>
        {/* Three-dot menu for sent messages - only show if there's text content */}
        {true && (
          <div className="flex items-start pt-2 pr-2 relative" ref={menuRef}>
            {<button
              onClick={toggleMenu}
              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>}
            
            {showMenu && (
              <div className={`absolute ${menuPosition.horizontal === 'right' ? 'right-0' : 'left-0'} ${menuPosition.vertical === 'bottom' ? 'top-10' : 'bottom-10'} w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10`}>
                {/* Only show Edit button if message has text content */}
                {(() => {
                  const { text } = parseMessageWithAttachment(decryptedContent);
                  return text.trim() && (
                    <button
                      onClick={handleEditClick}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2 flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                  );
                })()}
                <button
                  onClick={handleDeleteClick}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>DeleteFFF</span>
                </button>
              </div>
            )}
          </div>
        )}
        
        <div className="flex flex-col space-y-1">
          <FileAttachmentComponent 
            attachment={attachment!} 
            isReceived={isReceived}
            isLastUserMessage={isLastUserMessage}
            onEditClick={!isReceived ? () => onEditClick?.(message, decryptedContent) : undefined}
            onDeleteClick={!isReceived ? () => onDeleteClick?.(message) : undefined}
          />
          <div className={`flex items-center ${isReceived ? 'justify-start' : 'justify-end'}`}>
            <p className={`text-xs ${isReceived ? 'text-gray-500 dark:text-gray-400' : 'text-gray-500'}`}>
              {formatMessageTime(message.created_at)}
            </p>
            {!isReceived && (
              <div className="flex items-center ml-1">
                {message.status === 'sent' && (
                  <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {message.status === 'delivered' && (
                  <div className="flex">
                    <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <svg className="w-3 h-3 text-gray-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {message.status === 'read' && (
                  <div className="flex">
                    <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <svg className="w-3 h-3 text-green-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    (!isImageOnly && <div ref={messageRef} className={`mt-2 flex items-start ${isReceived ? 'justify-start' : 'justify-end'} group`}>
      {/* Three-dot menu for sent messages */}
      {!isReceived && decryptedContent !== '[deleted]' && text.trim() && (
        <div className="flex items-start pt-2 pr-2 relative" ref={menuRef}>
          {/*<button
            onClick={toggleMenu}
            className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>*/}
          
          {showMenu && (
            <div className={`absolute ${menuPosition.horizontal === 'right' ? 'right-0' : 'left-0'} ${menuPosition.vertical === 'bottom' ? 'top-10' : 'bottom-10'} w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10`}>
              {/* Only show Edit button if message has text content */}
              {(() => {
                const { text } = parseMessageWithAttachment(decryptedContent);
                return text.trim() && (
                  <button
                    onClick={handleEditClick}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit</span>
                  </button>
                );
              })()}
              <button
                onClick={handleDeleteClick}
                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className="flex flex-col space-y-1">
        {/* Only show text bubble if there's text content */}
        {text.trim() && (
          <div className={`max-w-xs lg:max-w-md ${
            isReceived ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white' : 'bg-blue-500 text-white'
          } rounded-2xl px-4 py-2 shadow-sm`}>
          {decryptedContent === '[deleted]' ? (
            <p className={`text-sm italic ${
              isReceived 
                ? 'text-gray-500 dark:text-gray-400' 
                : 'text-blue-200'
            }`}>
              This message has been deleted
            </p>
          ) : (
            <p className="text-sm">{text}</p>
          )}
          {decryptedContent !== '[deleted]' && (
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center space-x-1">
                <p className={`text-xs ${isReceived ? 'text-gray-500 dark:text-gray-400' : 'text-blue-100'}`}>
                  {formatMessageTime(message.created_at)}
                </p>
                {!isReceived && (
                  <div className="flex items-center ml-1">
                    {message.status === 'sent' && (
                      <svg className="w-3 h-3 text-blue-100" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {message.status === 'delivered' && (
                      <div className="flex">
                        <svg className="w-3 h-3 text-blue-100" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <svg className="w-3 h-3 text-blue-100 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {message.status === 'read' && (
                      <div className="flex">
                        <svg className="w-3 h-3 text-green-300" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <svg className="w-3 h-3 text-green-300 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        )}
        
        {/* Show attachment if present */}
        {attachment && (
          <FileAttachmentComponent 
            attachment={attachment} 
            isReceived={isReceived}
            isLastUserMessage={isLastUserMessage}
            onEditClick={!isReceived && text.trim() ? () => onEditClick?.(message, decryptedContent) : undefined}
            onDeleteClick={!isReceived ? () => onDeleteClick?.(message) : undefined}
          />
        )}
      </div>
    </div>)
  );
}

function EncryptionNotice() {
  return (
    <div className="text-center p-7">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        End-to-end encryption is enabled for this conversation. It is impossible to fetch previous messages.
      </p>
    </div>
  );
}

interface ConversationDetailProps {
  conversationId: string;
  onBack?: () => void;
}

export default function ConversationDetail({ conversationId, onBack }: ConversationDetailProps) {
  const { token, user } = useAuth();
  
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [remoteUser, setRemoteUser] = useState<{
    id: string;
    name: string;
    email: string;
    public_keys: Array<{
      id: string;
      public_key_value: string;
      created_at: string | null;
    }>;
  } | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Msg | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState<string>('');
  const [fileSizeError, setFileSizeError] = useState<string>('');


  // Use useRef to always have access to the latest remoteUser value
  const remoteUserRef = useRef(remoteUser);
  remoteUserRef.current = remoteUser;

  // Create a stable callback that uses the ref
  const handlePublicKeyCheckStable = useCallback(async (publicKeyId: string) => {
    if (!token || !remoteUserRef.current) return;
    
    // Patching the B user's first login issue where public key is not yet registered
    try {
      const response = await fetch(`/api/conversations/${conversationId}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.length !== 1) {
        console.error('Unexpected number of remote users:', data);
        return;
      }
      
      const updatedRemoteUser = data[0];
      console.log('Public keys refreshed successfully');
      setRemoteUser(updatedRemoteUser);
    } catch (error) {
      console.error('Error refreshing public keys:', error);
    }

  }, [token, conversationId, setRemoteUser]);
  
  const { messages, isConnected, initializeMessages, prependMessages } = useMessages(
    `conversation.${conversationId}`,
    user?.id,
    token || undefined,
    conversationId,
    (user?.public_key as any)?.id,
    handlePublicKeyCheckStable
  );
  //const { updateUnreadCount } = useConversations(user?.id, token || undefined);

  // Used for managing pagination
  let [furthestId, setFurthestId] = useState<number | null>(null);
  let [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  let [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true); // Assume more messages initially

  // Load more function
  const loadMore = useCallback(async () => {
    if (isLoadingMore) return; // Prevent multiple loads
    if (!token || !conversationId || !user?.id) return;
    if (!hasMoreMessages) return; // No more messages to load
    
    setIsLoadingMore(true);
    const response = await fetch(`/api/msgs?conversation_id=${conversationId}&before_id=${furthestId}&limit=20&public_key_id=${(user?.public_key as any).id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    if (response.ok) {
      const responseData = await response.json();
      const olderMessages = responseData.messages || [];
      const paginationInfo = responseData.pagination || {};

      console.log("=====>", paginationInfo)


      if (olderMessages.length == 0 || !paginationInfo.has_more) {
        setHasMoreMessages(false);
      } else {
        // Format messages
        const formattedMessages = olderMessages.map((msg: Msg) => ({
          ...msg,
          id: msg.id.toString(),
          conversation_id: msg.conversation_id.toString(),
          sender_id: msg.sender_id.toString()
        }));
        // Set the furtest Id
        setFurthestId(formattedMessages[0].id)
        // Update the message content
        prependMessages(formattedMessages);
        // Set has more messages
        setHasMoreMessages(paginationInfo.has_more || false)
      }
    }
    setIsLoadingMore(false);
  }, [token, conversationId, user?.id, isLoadingMore, hasMoreMessages, prependMessages])

  // Handle scrolling for seamless pagination
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const remainingPixels = e.currentTarget.scrollHeight - e.currentTarget.clientHeight + e.currentTarget.scrollTop;
    if (remainingPixels < 100){
      loadMore()
    }
  }

  useEffect(() => {
    if (!token) return;
    
    const fetchRemoteUsers = async () => {
      try {
        const response = await fetch(`/api/conversations/${conversationId}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        const data = await response.json();
        console.log("Retrieve remote users", data);
        if (data.length !== 1) {
          console.error('Unexpected number of remote users:', data);
          return;
        }
        setRemoteUser(data[0]);
      } catch (error) {
        console.error('Error fetching remote users:', error);
      }
    };

    fetchRemoteUsers();
  }, [token, conversationId]);

  useEffect(() => {
    if (!remoteUser) return;
    if (!user?.public_key) return;

    const userPrivateKey = getPrivateKey(user.public_key);
    if (userPrivateKey) {
      setEncryptionKey(userPrivateKey);
      console.log('Private key loaded successfully');
    } else {
      console.error('Private key not found in localStorage');
    }
  }, [user, remoteUser]);

  useEffect(() => {
    if (!token || !conversationId || !user?.id) return;

    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/msgs?conversation_id=${conversationId}&public_key_id=${(user?.public_key as any).id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const responseData = await response.json();
          const fetchedMessages = responseData.messages || [];
          const paginationInfo = responseData.pagination || {};

          const formattedMessages = fetchedMessages.map((msg: Msg) => ({
            ...msg,
            id: msg.id.toString(),
            conversation_id: msg.conversation_id.toString(),
            sender_id: msg.sender_id.toString()
          }));
          
          initializeMessages(formattedMessages);
          setFurthestId(formattedMessages[0].id)
          
          // Update pagination state based on API response
          setHasMoreMessages(paginationInfo.has_more || false);

          const messagesToMarkAsRead = formattedMessages
            .filter((msg: Msg) => msg.sender_id !== user.id && (msg.status === 'sent' || msg.status === 'delivered'))
            .map((msg: Msg) => msg.id);

          if (messagesToMarkAsRead.length > 0) {
            try {
              const readResponse = await fetch('/api/msgs/read', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  message_ids: messagesToMarkAsRead,
                  conversation_id: conversationId
                })
              });

              if (readResponse.ok) {
                const readResult = await readResponse.json();
                console.log(`Marked ${readResult.updated_count} messages as read`);
                
                if (readResult.updated_count > 0) {
                  // Messages marked as read - unread count will be reset by master component
                }
              } else {
                console.error('Error marking messages as read:', readResponse.statusText);
              }
            } catch (error) {
              console.error('Error marking messages as read:', error);
            }
          }
        } else {
          console.error('Error loading messages:', response.statusText);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, [token, conversationId, initializeMessages, user?.id/*, updateUnreadCount*/]);

  const handleMessageSend = async () => {
    if (!message.trim() && !selectedFile) return;
    
    if (!remoteUser?.public_keys || remoteUser.public_keys.length === 0) {
      console.error('Remote user public keys not available');
      return;
    }

    setIsSending(true);

    // If editing, handle edit instead of send
    if (editingMessage) {
      await handleEditMessage(editingMessage, message.trim());
      return;
    }

    try {
      let messageToSend = message.trim();

      if (selectedFile) {
        const presignedResponse = await fetch('/api/upload/presigned-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            fileType: selectedFile.type,
            fileSize: selectedFile.size,
          }),
        });

        if (!presignedResponse.ok) {
          throw new Error('Failed to get presigned URL');
        }

        const { presignedUrl, key } = await presignedResponse.json();

        const uploadResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: {
            'Content-Type': selectedFile.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }

        const fileUrl = `https://next-messenger.s3.ap-southeast-1.amazonaws.com/${key}`;
        const fileInfo = `(${selectedFile.name})[${fileUrl}]`;
        messageToSend = messageToSend ? `${messageToSend} ${fileInfo}` : fileInfo;

        console.log('File uploaded successfully:', key);
      }

      console.log("Public key list", [...remoteUser.public_keys, user?.public_key!])
      
      // Encrypt message for each public key and prepare data for batch sending
      const encryptedMessages = [];
      for (const publicKey of [...remoteUser.public_keys, user?.public_key!]) {
        const encryptedMessage = await encryptMessage(messageToSend, (publicKey as any).public_key_value);
        encryptedMessages.push({
          public_key_id: (publicKey as any).id,
          content: encryptedMessage
        });
      }

      // Send all encrypted messages in one request
      const response = await fetch('/api/msgs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          messages: encryptedMessages
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Message sent successfully:', data);
      } else {
        console.error('Error sending message:', response.statusText);
      }

      setMessage('');
      setSelectedFile(null);
      
      const fileInput = document.getElementById(`file-input-${conversationId}`) as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      console.error('Error sending message -:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (10MB = 10 * 1024 * 1024 bytes)
      const maxSizeInBytes = 10 * 1024 * 1024;
      if (file.size > maxSizeInBytes) {
        setFileSizeError(`File size exceeds 10MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
        setSelectedFile(null);
        // Clear the file input
        event.target.value = '';
        return;
      }
      
      // Clear any previous error and set the file
      setFileSizeError('');
      setSelectedFile(file);
      console.log('File selected:', file);
    }
  };

  const handleSendFileClick = () => {
    const fileInput = document.getElementById(`file-input-${conversationId}`) as HTMLInputElement;
    fileInput?.click();
  };

  const handleStartEdit = (messageToEdit: Msg, decryptedContent: string) => {
    const { text } = parseMessageWithAttachment(decryptedContent);
    
    setEditingMessage(messageToEdit);
    setEditingMessageContent(decryptedContent);
    // Set only the text content (without attachment metadata) in the edit form
    setMessage(text);
    // Clear any selected file when starting to edit
    setSelectedFile(null);
    const fileInput = document.getElementById(`file-input-${conversationId}`) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleDeleteMessage = async (messageToDelete: Msg) => {
    /*if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }*/

    // Delete is equivalent to editing the message to "[deleted]"
    await handleEditMessage(messageToDelete, '[deleted]');
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditingMessageContent('');
    setMessage('');
  };

  const handleEditMessage = async (messageEntity: Msg, newContent: string) => {
    if (!remoteUser?.public_keys || remoteUser.public_keys.length === 0 || !token || !user?.public_key) {
      console.error('Remote user public keys, user public key, or token not available');
      return;
    }

    try {
      // Use the already-decrypted content that includes attachment metadata
      const originalDecryptedContent = editingMessageContent;
      
      // Parse the original content to extract attachment metadata
      const { attachment: originalAttachment } = parseMessageWithAttachment(originalDecryptedContent);
      
      // If there was an attachment in the original message, re-attach it to the new content
      let finalContent = newContent;
      if (originalAttachment) {
        // Re-construct the message with the new text and original attachment
        finalContent = newContent.trim() 
          ? `${newContent.trim()} (${originalAttachment.fileName})[${originalAttachment.url}]`
          : `(${originalAttachment.fileName})[${originalAttachment.url}]`;
      }
      console.log("Original decrypted content:", originalDecryptedContent); // This doesn't include the attachment
      console.log('Final content to encrypt:', finalContent);
      console.log('Original attachment:', originalAttachment); // This returns NULL

      // Get all messages in the same batch using batch_id
      const batchResponse = await fetch(`/api/msgs/batch?batch_id=${messageEntity.batch_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!batchResponse.ok) {
        console.error('Error getting batch messages:', batchResponse.statusText);
        return;
      }

      const batchData = await batchResponse.json();
      const messagesInBatch = batchData.messages;

      // Encrypt message for each public key
      const encryptedMessages = [];
      for (const publicKey of [...remoteUser.public_keys, user?.public_key!]) {
        const encryptedMessage = await encryptMessage(finalContent, (publicKey as any).public_key_value);
        encryptedMessages.push({
          public_key_id: (publicKey as any).id,
          content: encryptedMessage
        });
      }

      // Send separate requests for each encrypted message
      const updatePromises = [];
      for (const encryptedMsg of encryptedMessages) {
        // Find the corresponding message in the batch for this public key
        const messageToUpdate = messagesInBatch.find((msg: any) => 
          msg.public_key_id?.toString() === encryptedMsg.public_key_id.toString()
        );

        if (messageToUpdate) {
          const updatePromise = fetch(`/api/msgs/${messageToUpdate.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              content: encryptedMsg.content
            })
          });
          updatePromises.push(updatePromise);
        }
      }

      // Wait for all updates to complete
      const responses = await Promise.all(updatePromises);
      const allSuccessful = responses.every(response => response.ok);

      console.log("====>edit message", finalContent)

      if (allSuccessful) {
        console.log('All messages edited successfully');
        setEditingMessage(null);
        setEditingMessageContent('');
        setMessage('');
      } else {
        console.error('Some message updates failed');
      }
    } catch (error) {
      console.error('Error editing message:', error);
    } finally {
      setIsSending(false);
    }
  };

  if (!remoteUser) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900" style={{height: '100vh'}}>
        <div className="flex flex-1 flex-col items-center space-y-4">
          <div className="flex flex-1 space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
          <div className="text-gray-600 dark:text-gray-400 text-sm">Loading conversation...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full flex-1">
      {/* Chat Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {/* Mobile back button - only show on mobile when onBack prop is provided */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full mr-2"
              aria-label="Go back"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
            {remoteUser.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white">{remoteUser.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isConnected ? 'Online' : 'Last seen recently'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/*<button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button> */}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900" style={{ display: 'flex', flexDirection: 'column-reverse' }} onScroll={handleScroll}>
        {messages.slice().reverse().map((msg, index, reversedMessages) => {
          const isReceived = msg.sender_id !== user?.id;
          // Find the last message sent by the user (first non-received message in the reversed array)
          const lastUserMessageId = reversedMessages.find(m => m.sender_id === user?.id)?.id;
          const isLastUserMessage = !isReceived && msg.id === lastUserMessageId;
          
          return (
            <DecryptedMessage
              key={msg.id}
              message={msg}
              encryptionKey={user?.private_key!}
              isReceived={isReceived}
              isLastUserMessage={isLastUserMessage}
              onEditClick={handleStartEdit}
              onDeleteClick={handleDeleteMessage}
            />
          );
        })}
        
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center py-12">
            <div className="w-16 h-16 mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12l-4-4h3V6h2v4h3l-4 4z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">No messages yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center">Send a message to start the conversation</p>
          </div>
        )}

        {isLoadingMore && (
          <div className="text-center text-gray-500 dark:text-gray-400">
            <span>Loading more messages...</span>
          </div>
        )}

        {!hasMoreMessages && messages.length > 0 && (<EncryptionNotice />)}
      </div>

      {/* Message Input */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        {editingMessage && (
          <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-600 rounded text-sm">
            <span className="font-medium text-gray-800 dark:text-gray-200">Editing message:</span> 
            <span className="text-gray-600 dark:text-gray-300"> Click "Update" to save changes or "Cancel" to stop editing.</span>
          </div>
        )}
        <div className="flex items-center space-x-3">
          <div className="flex-1 flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-full px-4 py-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={editingMessage ? "Edit your message..." : "Type a message..."}
              className={`flex-1 bg-transparent focus:outline-none text-gray-800 dark:text-white ${
                editingMessage ? 'placeholder-orange-400 dark:placeholder-orange-300' : 'placeholder-gray-500 dark:placeholder-gray-400'
              }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleMessageSend();
                }
              }}
            />
            {!editingMessage && (
              <button
                onClick={handleSendFileClick}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full w-8 h-8 flex items-center justify-center"
              >
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={handleMessageSend}
            disabled={isSending || (!message.trim() && !selectedFile)}
            className={`p-2 rounded-full w-10 h-10 flex items-center justify-center ${
              isSending || (!message.trim() && !selectedFile)
                ? 'bg-gray-400 cursor-not-allowed text-white' 
                : editingMessage
                  ? 'bg-orange-600 hover:bg-orange-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isSending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>
          {editingMessage && (
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
        </div>

        <input
          id={`file-input-${conversationId}`}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile && (
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-2">
            Selected file: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
          </div>
        )}
        
        {fileSizeError && (
          <div className="text-sm text-red-600 dark:text-red-400 mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            {fileSizeError}
          </div>
        )}
      </div>
    </div>
  );
}