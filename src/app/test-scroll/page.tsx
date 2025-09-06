"use client";
import { useEffect, useState } from "react";


export default function TestScroll() {
    let [items, setItems] = useState<string[]>([]);
    let [furthestId, setFurthestId] = useState<number | null>(null);
    // This is used to avoid multiple loads at the same time
    let [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

    // Load more function
    const loadMore = async () => {
        if (isLoadingMore) return; // Prevent multiple loads
        setIsLoadingMore(true);
        console.log("load more");
        setTimeout(() => {
            for (let i = 1; i <= 20; i++) {
                const newId = (furthestId || 0) + i;
                setItems((items) => [...items, `Hello world ${newId}`]);
            }
            setFurthestId((furthestId || 0) + 20);
            console.log("loaded more");
            setIsLoadingMore(false);
        }, 400);
    }

    // On initialization
    useEffect(() => {
        setItems([]);
        for (let i = 0; i < 20; i++) {
            setItems((items) => [...items, `Hello world ${i}`]);
        }
        setFurthestId(19);
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const remainingPixels = e.currentTarget.scrollHeight - e.currentTarget.clientHeight + e.currentTarget.scrollTop;
        if (remainingPixels < 100) {
            loadMore();
        }
    }

    return (
        <div style={{ width: "100vw", height: "400px", display: "flex", flexDirection: "column-reverse", overflowY: "scroll", backgroundColor: "lightgray" }} onScroll={handleScroll}>
            {items.map((item, index) => (
                <span key={index}>{item}</span>
            ))}
        </div>
    );
}