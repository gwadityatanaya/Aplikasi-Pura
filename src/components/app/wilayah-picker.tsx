"use client";
import * as React from "react";
import { Check, ChevronDown, Loader2, PencilLine, Search, X } from "lucide-react";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/format";

/** Address as stored for a banjar or temple. Codes are Kemendagri codes; names are always filled. */
export interface AddressValue {
  province: string;
  regency: string;
  district: string;
  village: string;
  provinceCode?: string | null;
  regencyCode?: string | null;
  districtCode?: string | null;
  villageCode?: string | null;
}

export const emptyAddress: AddressValue = { province: "", regency: "", district: "", village: "", provinceCode: null, regencyCode: null, districtCode: null, villageCode: null };

const LEVELS = [
  { key: "province", label: "Provinsi", what: "provinsi" },
  { key: "regency", label: "Kabupaten / Kota", what: "kabupaten/kota" },
  { key: "district", label: "Kecamatan", what: "kecamatan" },
  { key: "village", label: "Desa / Kelurahan", what: "desa/kelurahan" },
] as const;
type LevelKey = (typeof LEVELS)[number]["key"];
type Item = [code: string, name: string];

// Lists are fetched once per parent from our own server (bundled data file) and kept in memory.
const lists = new Map<string, Promise<Item[]>>();
function loadChildren(parent: string): Promise<Item[]> {
  let p = lists.get(parent);
  if (!p) {
    p = fetch(`/api/wilayah${parent ? `?induk=${encodeURIComponent(parent)}` : ""}`)
      .then((r) => r.json())
      .then((j) => (j.ok ? (j.items as Item[]) : []))
      .catch(() => {
        lists.delete(parent);
        return [];
      });
    lists.set(parent, p);
  }
  return p;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Cascading address picker: Provinsi → Kabupaten/Kota → Kecamatan → Desa/Kelurahan.
 * Each level only lists the children of the level above; changing a level empties the levels
 * below. Every level can be searched by typing, and has "Tidak ada di daftar" for manual text.
 * All levels are optional.
 */
export function WilayahPicker({ value, onChange, idPrefix }: { value: AddressValue; onChange: (v: AddressValue) => void; idPrefix: string }) {
  const set = (index: number, code: string | null, name: string) => {
    const next: AddressValue = { ...value };
    LEVELS.forEach((l, i) => {
      if (i === index) {
        next[l.key] = name;
        next[`${l.key}Code`] = code;
      } else if (i > index) {
        next[l.key] = "";
        next[`${l.key}Code`] = null;
      }
    });
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {LEVELS.map((l, i) => {
        const parent = i === 0 ? null : LEVELS[i - 1];
        const parentCode = parent ? value[`${parent.key}Code`] ?? null : "";
        const parentName = parent ? value[parent.key] : "x";
        // Above was typed by hand → this level can only be typed by hand too.
        const forcedManual = !!parent && !parentCode && !!parentName;
        const blocked = !!parent && !parentCode && !parentName;
        return (
          <LevelField
            key={l.key}
            id={`${idPrefix}-${l.key}`}
            label={l.label}
            what={l.what}
            parentCode={parentCode ?? ""}
            parentWhat={parent?.what}
            code={value[`${l.key}Code`] ?? null}
            name={value[l.key]}
            forcedManual={forcedManual}
            blocked={blocked}
            onPick={(code, name) => set(i, code || null, name)}
            onManual={(name) => set(i, null, name)}
          />
        );
      })}
    </div>
  );
}

function LevelField({
  id, label, what, parentCode, parentWhat, code, name, forcedManual, blocked, onPick, onManual,
}: {
  id: string;
  label: string;
  what: string;
  parentCode: string;
  parentWhat?: string;
  code: string | null;
  name: string;
  forcedManual: boolean;
  blocked: boolean;
  onPick: (code: string, name: string) => void;
  onManual: (name: string) => void;
}) {
  // Manual mode: no code but a name (old free-text data, or "tidak ada di daftar").
  const [manual, setManual] = React.useState(!code && !!name);
  const isManual = forcedManual || manual;
  React.useEffect(() => {
    if (!code && !name && !forcedManual) setManual(false); // emptied because a level above changed
  }, [code, name, forcedManual]);

  if (blocked) {
    return (
      <div>
        <span className="mb-1.5 block text-[15px] font-semibold text-charcoal">{label} <span className="font-normal text-muted">(opsional)</span></span>
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[15px] text-muted">Pilih {parentWhat} terlebih dahulu.</p>
      </div>
    );
  }

  if (isManual) {
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-[15px] font-semibold text-charcoal">{label} <span className="font-normal text-muted">(opsional, ketik manual)</span></label>
        <Input id={id} value={name} maxLength={100} onChange={(e) => onManual(e.target.value)} placeholder={`Ketik nama ${what}`} autoComplete="off" />
        {forcedManual ? (
          <p className="mt-1 text-sm text-muted">Diisi manual karena {parentWhat} di atas diisi manual.</p>
        ) : (
          <button type="button" className="mt-1 text-sm font-semibold text-emerald-700 hover:underline" onClick={() => { setManual(false); onManual(""); }}>
            Pilih dari daftar saja
          </button>
        )}
      </div>
    );
  }

  return <ComboBox id={id} label={label} what={what} parentCode={parentCode} code={code} name={name} onPick={onPick} onManual={() => { setManual(true); onManual(""); }} />;
}

function ComboBox({
  id, label, what, parentCode, code, name, onPick, onManual,
}: {
  id: string;
  label: string;
  what: string;
  parentCode: string;
  code: string | null;
  name: string;
  onPick: (code: string, name: string) => void;
  onManual: () => void;
}) {
  const [items, setItems] = React.useState<Item[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = `${id}-daftar`;

  React.useEffect(() => {
    let alive = true;
    setItems(null);
    loadChildren(parentCode).then((r) => alive && setItems(r));
    return () => {
      alive = false;
    };
  }, [parentCode]);

  const MAX = 80;
  const filtered = React.useMemo(() => {
    if (!items) return [];
    const q = norm(query);
    return q ? items.filter(([, n]) => norm(n).includes(q)) : items;
  }, [items, query]);
  const shown = filtered.slice(0, MAX);
  const options = shown.length; // + 1 for "tidak ada di daftar"

  const pick = (it: Item) => {
    onPick(it[0], it[1]);
    setOpen(false);
    setQuery("");
  };
  const chooseManual = () => {
    setOpen(false);
    setQuery("");
    onManual();
  };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (active < shown.length) pick(shown[active]);
      else chooseManual();
    } else if (e.key === "Escape" && open) {
      // Close only the list — not the dialog around it.
      e.stopPropagation();
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[15px] font-semibold text-charcoal">
        {label} <span className="font-normal text-muted">(opsional)</span>
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${id}-opsi-${active}` : undefined}
          autoComplete="off"
          className="pl-11 pr-11"
          value={open ? query : name}
          placeholder={open && name ? name : `Cari atau pilih ${what}…`}
          onFocus={() => { setOpen(true); setActive(0); }}
          onClick={() => { if (!open) { setOpen(true); setActive(0); } }}
          onBlur={() => { setOpen(false); setQuery(""); }}
          onChange={(e) => {
            // While the list is closed the box shows the chosen name; typing then starts a NEW search
            // instead of adding letters to that name.
            const v = e.target.value;
            setQuery(open ? v : v.startsWith(name) ? v.slice(name.length) : v);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        {code && !open ? (
          <Check className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600" aria-hidden />
        ) : items === null ? (
          <Loader2 className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted" aria-label="Memuat" />
        ) : (
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        )}
      </div>
      {open && (
        // Options keep the focus in the text box (pointerdown is cancelled), so typing never jumps.
        <ul id={listId} role="listbox" aria-label={label} className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-white shadow-soft">
          {items === null && <li className="px-4 py-3 text-[15px] text-muted">Memuat daftar…</li>}
          {items !== null && shown.length === 0 && <li className="px-4 py-3 text-[15px] text-muted">Tidak ditemukan &quot;{query}&quot;.</li>}
          {shown.map((it, i) => (
            <li
              key={it[0]}
              id={`${id}-opsi-${i}`}
              role="option"
              aria-selected={it[0] === code}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(it)}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center justify-between px-4 py-3 text-[16px]", i === active && "bg-mint", it[0] === code && "font-semibold")}
            >
              {it[1]}
              {it[0] === code && <Check className="h-4 w-4 text-emerald-600" aria-hidden />}
            </li>
          ))}
          {filtered.length > MAX && <li className="px-4 py-2 text-sm text-muted">+{filtered.length - MAX} lainnya — ketik untuk mempersempit.</li>}
          {items !== null && (
            <li
              id={`${id}-opsi-${shown.length}`}
              role="option"
              aria-selected={false}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={chooseManual}
              onMouseEnter={() => setActive(shown.length)}
              className={cn("flex cursor-pointer items-center gap-2 border-t border-line px-4 py-3 text-[15px] font-semibold text-emerald-800", active === shown.length && "bg-mint")}
            >
              <PencilLine className="h-4 w-4" /> Tidak ada di daftar — ketik manual
            </li>
          )}
        </ul>
      )}
      {code && !open && (
        <button type="button" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-charcoal" onClick={() => { onPick("", ""); }}>
          <X className="h-3.5 w-3.5" /> Kosongkan
        </button>
      )}
    </div>
  );
}
