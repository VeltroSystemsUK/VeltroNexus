import { SterlingShell } from "./SterlingShell";

export default function SterlingDesk({ children }: { children: React.ReactNode }) {
  return <SterlingShell wide>{children}</SterlingShell>;
}
