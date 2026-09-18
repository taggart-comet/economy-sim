"use client";
import { useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import type { ComponentProps } from "react";
/** The shared primitive labels its root. Give its focusable thumb the same accessible name. */
export function NamedSlider(props: ComponentProps<typeof Slider>) {
  const label = props["aria-label"];
  const ref = useCallback(
    (node: HTMLSpanElement | null) => {
      if (node && label)
        node
          .querySelectorAll('[role="slider"]')
          .forEach((thumb) => thumb.setAttribute("aria-label", label));
    },
    [label],
  );
  return <Slider {...props} ref={ref} />;
}
