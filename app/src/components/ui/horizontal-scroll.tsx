import React, { useState, useEffect, useRef, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HorizontalScrollProps {
	children: ReactNode;
	className?: string;
	showShadows?: boolean;
	shadowColor?: string;
	shadowWidth?: number;
	showArrows?: boolean;
	scrollAmount?: number;
	debug?: boolean;
}

export const HorizontalScroll: React.FC<HorizontalScrollProps> = ({
	children,
	className = "",
	showShadows = true,
	shadowColor = "black",
	shadowWidth = 6,
	showArrows = false,
	scrollAmount = 320,
	debug = false,
}) => {
	const [showLeftShadow, setShowLeftShadow] = useState(false);
	const [showRightShadow, setShowRightShadow] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	const checkShadows = () => {
		if (!scrollRef.current) return;

		const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
		const shouldShowLeft = scrollLeft > 0;
		const shouldShowRight = scrollLeft < scrollWidth - clientWidth - 1;

		setShowLeftShadow(shouldShowLeft);
		setShowRightShadow(shouldShowRight);

		if (debug) {
			console.log("Scroll check:", {
				scrollLeft,
				scrollWidth,
				clientWidth,
				shouldShowLeft,
				shouldShowRight,
			});
		}
	};

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;

		checkShadows();
		element.addEventListener("scroll", checkShadows);
		window.addEventListener("resize", checkShadows);

		return () => {
			element.removeEventListener("scroll", checkShadows);
			window.removeEventListener("resize", checkShadows);
		};
	}, [debug]);

	const shadowClasses = {
		left: `absolute left-0 top-0 bottom-0 w-${shadowWidth} bg-gradient-to-r from-${shadowColor}/50 via-${shadowColor}/30 to-transparent pointer-events-none z-20`,
		right: `absolute right-0 top-0 bottom-0 w-${shadowWidth} bg-gradient-to-l from-${shadowColor}/50 via-${shadowColor}/30 to-transparent pointer-events-none z-20`,
	};

	return (
		<div className={`relative ${className}`}>
			{/* Debug indicator */}
			{debug && (
				<div className="absolute -top-6 left-0 text-xs text-red-400">
					Left: {showLeftShadow ? "ON" : "OFF"} | Right:{" "}
					{showRightShadow ? "ON" : "OFF"}
				</div>
			)}

			{/* Left shadow */}
			{showShadows && showLeftShadow && (
				<div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-black/50 via-black/30 to-transparent pointer-events-none z-20" />
			)}

			{/* Right shadow */}
			{showShadows && showRightShadow && (
				<div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-black/50 via-black/30 to-transparent pointer-events-none z-20" />
			)}

			{/* Left arrow */}
			{showArrows && showLeftShadow && (
				<button
					onClick={() => scrollRef.current?.scrollBy({ left: -scrollAmount, behavior: "smooth" })}
					className="absolute left-2 top-1/2 -translate-y-1/2 z-30 hidden md:flex w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white items-center justify-center transition-colors"
					aria-label="Scroll left"
				>
					<ChevronLeft className="w-5 h-5" />
				</button>
			)}

			{/* Right arrow */}
			{showArrows && showRightShadow && (
				<button
					onClick={() => scrollRef.current?.scrollBy({ left: scrollAmount, behavior: "smooth" })}
					className="absolute right-2 top-1/2 -translate-y-1/2 z-30 hidden md:flex w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white items-center justify-center transition-colors"
					aria-label="Scroll right"
				>
					<ChevronRight className="w-5 h-5" />
				</button>
			)}

			{/* Scrollable content */}
			<div
				ref={scrollRef}
				className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
			>
				{children}
			</div>
		</div>
	);
};
