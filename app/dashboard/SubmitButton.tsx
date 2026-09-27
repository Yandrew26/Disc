"use client";

import { useFormStatus } from "react-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

export default function SubmitButton({
  children,
  pendingText,
  confirmText,
  className,
  variant = "default",
  size = "default",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingText?: string;
  confirmText?: string;
  className?: string;
  disabled?: boolean;
} & VariantProps<typeof buttonVariants>) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
      onClick={confirmText ? (e) => { if (!confirm(confirmText)) e.preventDefault(); } : undefined}
    >
      {pending ? (pendingText ?? "…") : children}
    </Button>
  );
}
