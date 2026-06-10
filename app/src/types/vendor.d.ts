// Minimal local type declarations for untyped third-party modules.
// (Adding @types packages is not possible without package.json changes.)

declare module 'tinycolor2' {
	namespace tinycolor {
		// The color-picker code only needs a callable instance surface; keep it loose.
		interface Instance {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			[key: string]: any;
		}
		namespace ColorFormats {
			interface RGBA {
				r: number;
				g: number;
				b: number;
				a: number;
			}
			interface HSVA {
				h: number;
				s: number;
				v: number;
				a: number;
			}
			interface HSLA {
				h: number;
				s: number;
				l: number;
				a: number;
			}
		}
	}

	interface TinycolorStatic {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(color?: any, opts?: Record<string, unknown>): tinycolor.Instance;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any;
	}

	const tinycolor: TinycolorStatic;
	export = tinycolor;
}

declare module '@radix-ui/react-popover' {
	import * as React from 'react';

	export interface PopoverProps {
		children?: React.ReactNode;
		open?: boolean;
		defaultOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		modal?: boolean;
	}

	export const Root: React.FC<PopoverProps>;

	export const Trigger: React.ForwardRefExoticComponent<
		React.ComponentPropsWithoutRef<'button'> & {
			asChild?: boolean;
		} & React.RefAttributes<HTMLButtonElement>
	>;

	export const Anchor: React.ForwardRefExoticComponent<
		React.ComponentPropsWithoutRef<'div'> & {
			asChild?: boolean;
		} & React.RefAttributes<HTMLDivElement>
	>;

	export const Portal: React.FC<{
		children?: React.ReactNode;
		container?: Element | DocumentFragment | null;
		forceMount?: true;
	}>;

	export const Content: React.ForwardRefExoticComponent<
		React.ComponentPropsWithoutRef<'div'> & {
			asChild?: boolean;
			side?: 'top' | 'right' | 'bottom' | 'left';
			sideOffset?: number;
			align?: 'start' | 'center' | 'end';
			alignOffset?: number;
			avoidCollisions?: boolean;
			forceMount?: true;
			onOpenAutoFocus?: (event: Event) => void;
			onCloseAutoFocus?: (event: Event) => void;
			onEscapeKeyDown?: (event: KeyboardEvent) => void;
			onPointerDownOutside?: (event: Event) => void;
			onInteractOutside?: (event: Event) => void;
		} & React.RefAttributes<HTMLDivElement>
	>;

	export const Arrow: React.ForwardRefExoticComponent<
		React.ComponentPropsWithoutRef<'svg'> & {
			asChild?: boolean;
		} & React.RefAttributes<SVGSVGElement>
	>;

	export const Close: React.ForwardRefExoticComponent<
		React.ComponentPropsWithoutRef<'button'> & {
			asChild?: boolean;
		} & React.RefAttributes<HTMLButtonElement>
	>;
}
