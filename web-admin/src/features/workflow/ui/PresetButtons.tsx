"use client";

interface PresetButtonsProps {
  productCatalog: Array<{ id: string; name: string; serviceCategory: string; price: number }>;
  onAddPreset: (items: Array<{ productId: string; serviceCategoryCode: string; quantity: number }>) => Promise<void> | void;
}

export function PresetButtons({ productCatalog, onAddPreset }: PresetButtonsProps) {
  // naive: pick first matching products for demo presets
  const shirt = productCatalog.find((p) => /shirt/i.test(p.name)) || productCatalog[0];
  const pants = productCatalog.find((p) => /pant/i.test(p.name)) || productCatalog[0];

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
        onClick={() =>
          onAddPreset([
            { productId: shirt?.id, serviceCategoryCode: shirt?.serviceCategory, quantity: 5 },
          ] as any)
        }
      >
        +5 Shirts
      </button>
      <button
        type="button"
        className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
        onClick={() =>
          onAddPreset([
            { productId: pants?.id, serviceCategoryCode: pants?.serviceCategory, quantity: 2 },
          ] as any)
        }
      >
        +2 Pants
      </button>
    </div>
  );
}


