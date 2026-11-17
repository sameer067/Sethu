"use client";

import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";

export interface NumericInputProps
  extends Omit<InputProps, "value" | "onChange" | "type"> {
  value: number;
  onValueChange: (value: number) => void;
}

const toNumber = (text: string) => parseFloat(text) || 0;

/**
 * Number input that keeps the raw text the user typed (e.g. "1.0", "0.05")
 * while reporting the parsed number to the parent. A plain controlled input
 * bound to a number re-renders "1.0" as "1", which makes it impossible to type
 * a 0 after the decimal point.
 */
export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onValueChange, ...props }, ref) => {
    const [text, setText] = React.useState(() => (value ? String(value) : ""));

    // Show the typed text while it still represents the current value; if the
    // parent changed the value (reset, clamp to max, etc.) show the new value.
    const display = toNumber(text) === (value || 0) ? text : value ? String(value) : "";

    return (
      <Input
        {...props}
        ref={ref}
        type="number"
        inputMode="decimal"
        value={display}
        onChange={(e) => {
          setText(e.target.value);
          onValueChange(toNumber(e.target.value));
        }}
      />
    );
  }
);
NumericInput.displayName = "NumericInput";
