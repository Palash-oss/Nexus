import { useEffect } from "react";

type UseKeyboardShortcutsProps = {
  onFocusSearch: () => void;
  onClearSearch: () => void;
  onToggleHelp: () => void;
  onNavigateResults: (direction: "up" | "down") => void;
  onSelectResult: () => void;
  isSearchFocused: boolean;
};

export function useKeyboardShortcuts({
  onFocusSearch,
  onClearSearch,
  onToggleHelp,
  onNavigateResults,
  onSelectResult,
  isSearchFocused,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // ⌘K or Ctrl+K -> Focus Search
      if (isCmdOrCtrl && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onFocusSearch();
        return;
      }

      // Escape -> Clear & Unfocus Search
      if (event.key === "Escape") {
        event.preventDefault();
        onClearSearch();
        return;
      }

      // ⌘/ or Ctrl+/ -> Toggle Help Modal
      if (isCmdOrCtrl && event.key === "/") {
        event.preventDefault();
        onToggleHelp();
        return;
      }

      // Arrow navigation when search is focused or active
      if (isSearchFocused) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onNavigateResults("down");
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          onNavigateResults("up");
        } else if (event.key === "Enter") {
          // Open selected item
          event.preventDefault();
          onSelectResult();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    onFocusSearch,
    onClearSearch,
    onToggleHelp,
    onNavigateResults,
    onSelectResult,
    isSearchFocused,
  ]);
}
