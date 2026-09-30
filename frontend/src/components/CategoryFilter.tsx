import React from 'react';

interface CategoryFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const categories = [
  { id: 'all', label: 'Semua Kategori' },
  { id: 'concerts', label: 'Konser Musik' },
  { id: 'festivals', label: 'Festival' },
  { id: 'cinema', label: 'Bioskop' },
  { id: 'sports', label: 'Olahraga' },
  { id: 'social', label: 'Seminar & Workshop' },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 no-scrollbar">
      {categories.map((cat) => {
        const isActive = selectedCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
              isActive
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/90'
            }`}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
};
