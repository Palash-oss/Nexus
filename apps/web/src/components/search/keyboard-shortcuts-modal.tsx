import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-nexus-border bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-nexus-text">Keyboard Shortcuts</h3>
            <p className="text-xs text-nexus-muted mt-0.5">Control Nexus with quick keys</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4 text-nexus-muted" />
          </Button>
        </header>

        <div className="space-y-4">
          <ShortcutRow keys={["⌘", "K"]} desc="Focus the search input bar" altKeys={["Ctrl", "K"]} />
          <ShortcutRow keys={["Esc"]} desc="Clear search query and close keyboard mode" />
          <ShortcutRow keys={["↓", "↑"]} desc="Navigate through search result cards" />
          <ShortcutRow keys={["Enter"]} desc="Open the highlighted search result in a new tab" />
          <ShortcutRow keys={["⌘", "/"]} desc="Toggle this keyboard shortcuts guide" altKeys={["Ctrl", "/"]} />
        </div>

        <div className="mt-8 text-center">
          <Button onClick={onClose} variant="outline" className="w-full">
            Got it, close
          </Button>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, desc, altKeys }: { keys: string[]; desc: string; altKeys?: string[] }) {
  return (
    <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-[#4a5f86] font-medium">{desc}</span>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1">
          {keys.map((k, i) => (
            <kbd
              key={i}
              className="inline-flex items-center justify-center rounded border border-[#cbd5e1] bg-[#f8fafc] px-2 py-1 text-xs font-semibold text-[#334155] shadow-sm min-w-[24px]"
            >
              {k}
            </kbd>
          ))}
        </div>
        {altKeys && (
          <>
            <span className="text-xs text-nexus-muted">or</span>
            <div className="flex items-center gap-1">
              {altKeys.map((k, i) => (
                <kbd
                  key={i}
                  className="inline-flex items-center justify-center rounded border border-[#cbd5e1] bg-[#f8fafc] px-1.5 py-1 text-[10px] font-semibold text-[#64748b] shadow-sm min-w-[24px]"
                >
                  {k}
                </kbd>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
