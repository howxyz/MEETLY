import { colorFor, initials } from "@/lib/ui";
export default function Avatar({ name, size = 28 }) {
  return <span className="avatar" title={name} style={{ background: colorFor(name), width: size, height: size }}>{initials(name)}</span>;
}
