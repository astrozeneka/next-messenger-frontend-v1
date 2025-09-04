"use client";
import { useEffect, useState } from "react";


export default function TestScroll() {
    let [items, setItems] = useState<string[]>([]);
    let [furthestId, setFurthestId] = useState<number | null>(null);

    // On initialization
    useEffect(() => {
        setItems([]);
        for (let i = 0; i < 20; i++) {
            setItems((items) => [...items, `Hello world ${i}`]);
        }
        setFurthestId(19);
    }, []);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        console.log("scroll", e.currentTarget.scrollTop);
    }

    return (
        <div style={{ width: "100vw", height: "400px", display: "flex", flexDirection: "column-reverse", overflowY: "scroll", backgroundColor: "lightgray" }} onScroll={handleScroll}>
            {items.map((item, index) => (
                <span key={index}>{item}</span>
            ))}
        </div>
    );
}