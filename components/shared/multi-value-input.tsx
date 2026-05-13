"use client";

import type React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MultiValueInputProps = {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  addLabel: string;
  type?: React.HTMLInputTypeAttribute;
};

export function MultiValueInput({
  values,
  onChange,
  placeholder,
  addLabel,
  type = "text",
}: MultiValueInputProps) {
  const rows = values.length > 0 ? values : [""];

  function updateValue(index: number, nextValue: string) {
    const nextValues = [...rows];
    nextValues[index] = nextValue;
    onChange(nextValues);
  }

  function addValue() {
    onChange([...rows, ""]);
  }

  function removeValue(index: number) {
    const nextValues = rows.filter((_, itemIndex) => itemIndex !== index);
    onChange(nextValues);
  }

  return (
    <div className="space-y-2">
      {rows.map((value, index) => (
        <div key={`${index}-${value}`} className="flex items-center gap-2">
          <Input
            type={type}
            value={value}
            onChange={(event) => updateValue(index, event.target.value)}
            placeholder={index === 0 ? placeholder : undefined}
          />
          {rows.length > 1 ? (
            <Button type="button" variant="outline" size="icon" onClick={() => removeValue(index)} aria-label={`Remove ${addLabel}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="px-0 text-primary" onClick={addValue}>
        <Plus className="mr-1 h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}
