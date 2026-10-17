import { fieldsOf } from "../app/unchecked";
import type { Node } from "./split-tree";

// A split tree with pane positions in place of panes (pure), to save the
// user's own arrangement and build it again for reopened panes. A saved
// tree is used only when it is whole: every pane exactly once, and sizes
// that are positive fractions adding up to 1.

/** `node` with each item replaced by its position in `items`; null when an item is not there. */
export function shapeOf<T>(node: Node<T>, items: readonly T[]): Node<number> | null {
  if (node.kind === "leaf") {
    const index = items.indexOf(node.item);
    return index < 0 ? null : { kind: "leaf", item: index };
  }
  const children = node.children.map((child) => shapeOf(child, items));
  if (children.some((child) => child === null)) return null;
  return { kind: "split", axis: node.axis, children: children as Node<number>[], sizes: [...node.sizes] };
}

function validSizes(sizes: unknown, count: number): sizes is number[] {
  if (!Array.isArray(sizes) || sizes.length !== count) return false;
  if (!sizes.every((s) => typeof s === "number" && s > 0)) return false;
  return Math.abs(sizes.reduce((sum: number, s: number) => sum + s, 0) - 1) < 0.01;
}

/** A saved shape as a tree of `items`, or null when it does not fit them. */
export function treeFrom<T>(raw: unknown, items: readonly T[]): Node<T> | null {
  const used = new Set<number>();
  const build = (value: unknown): Node<T> | null => {
    const r = fieldsOf(value);
    if (r.kind === "leaf") {
      const i = r.item;
      if (typeof i !== "number" || !Number.isInteger(i) || i < 0 || i >= items.length || used.has(i)) return null;
      used.add(i);
      return { kind: "leaf", item: items[i] };
    }
    if (r.kind !== "split" || (r.axis !== "row" && r.axis !== "column")) return null;
    if (!Array.isArray(r.children) || r.children.length < 2 || !validSizes(r.sizes, r.children.length)) return null;
    const children = r.children.map(build);
    if (children.some((child) => child === null)) return null;
    return { kind: "split", axis: r.axis, children: children as Node<T>[], sizes: [...r.sizes] };
  };
  const tree = build(raw);
  return tree && used.size === items.length ? tree : null;
}
