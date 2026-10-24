"use client";

import { useRouter } from "next/navigation";

export function BrandSwitcher({
  brands,
  currentId,
  path,
  label,
}: {
  brands: { id: string; name: string }[];
  currentId?: string;
  path: string;
  label: string;
}) {
  const router = useRouter();
  if (brands.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span>{label}</span>
      <select
        className="w-auto py-1.5 text-xs"
        value={currentId}
        onChange={(event) => router.push(`${path}?brand=${event.target.value}`)}
      >
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>{brand.name}</option>
        ))}
      </select>
    </label>
  );
}
