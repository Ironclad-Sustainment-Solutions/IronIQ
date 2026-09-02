import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Code2,
  Compass,
  Factory,
  FileImage,
  FileStack,
  ListChecks,
  Package,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  useUniversalSearch,
  type SearchResult,
  type SearchResultType,
} from "@/lib/universal-search-api";

const TYPE_ICON: Record<SearchResultType, LucideIcon> = {
  machine: Factory,
  part: Package,
  finding: ListChecks,
  assessment: FileStack,
  cad_job: FileImage,
  cnc_entry: Code2,
  organization: Building2,
  facility: Factory,
  page: Compass,
};

const TYPE_GROUP_LABEL: Record<SearchResultType, string> = {
  machine: "Machines",
  part: "Parts",
  finding: "Findings",
  assessment: "Assessments",
  cad_job: "CAD Jobs",
  cnc_entry: "CNC Entries",
  organization: "Organizations",
  facility: "Facilities",
  page: "Pages",
};

function groupResults(
  results: SearchResult[],
): Map<SearchResultType, SearchResult[]> {
  const groups = new Map<SearchResultType, SearchResult[]>();
  for (const r of results) {
    const existing = groups.get(r.type) ?? [];
    existing.push(r);
    groups.set(r.type, existing);
  }
  return groups;
}

export function UniversalSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const search = useUniversalSearch(debouncedQuery);
  const results = search.data?.results ?? [];
  const looksLikeQuestion = search.data?.looksLikeQuestion ?? false;
  const grouped = groupResults(results);

  function goTo(href: string) {
    setOpen(false);
    setQuery("");
    void navigate({ to: href });
  }

  function askIronIQ() {
    const question = query.trim();
    setOpen(false);
    setQuery("");
    void navigate({ to: "/ask-ironiq", search: { q: question } });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-xs items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-1.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="truncate">Search machines, parts, findings…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-sidebar-border bg-sidebar px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/60 sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search machines, parts, findings, assessments… or ask a question"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.trim().length === 0 ? (
            <CommandEmpty>
              Start typing to search, or ask a question.
            </CommandEmpty>
          ) : search.isLoading ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : results.length === 0 && !looksLikeQuestion ? (
            <CommandEmpty>No matches. Try a different term.</CommandEmpty>
          ) : null}

          {looksLikeQuestion ? (
            <CommandGroup heading="Ask IronIQ">
              <CommandItem onSelect={askIronIQ} value={`ask-ironiq-${query}`}>
                <Sparkles
                  className="size-4 shrink-0 text-primary"
                  aria-hidden
                />
                <span>
                  Ask IronIQ:{" "}
                  <span className="italic">&ldquo;{query}&rdquo;</span>
                </span>
              </CommandItem>
            </CommandGroup>
          ) : null}

          {Array.from(grouped.entries()).map(([type, items]) => {
            const Icon = TYPE_ICON[type];
            return (
              <CommandGroup key={type} heading={TYPE_GROUP_LABEL[type]}>
                {items.map((item) => (
                  <CommandItem
                    key={`${type}-${item.id}`}
                    value={`${type}-${item.id}-${item.label}`}
                    onSelect={() => goTo(item.href)}
                  >
                    <Icon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="truncate">{item.label}</span>
                    {item.sublabel ? (
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {item.sublabel}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
