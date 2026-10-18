import { cx } from "../../lib/format";

export interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cx("skeleton rounded-xl", className)} />;
}
