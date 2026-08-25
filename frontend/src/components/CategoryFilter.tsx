import React from 'react';

interface CategoryFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const categories = [
  { id: 'all', label: 'See All' },
  { id: 'concerts', label: 'Concerts' },
  { id: 'festivals', label: 'Festivals' },
  { id: 'cinema', label: 'Cinema' },
  { id: 'sports', label: 'Sports' },
  { id: 'social', label: 'Social' },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 no-scrollbar">
      {categories.map((cat) => {
        const isActive = selectedCategory === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 ${
              isActive
                ? 'bg-pill-active text-white shadow-btn scale-[1.03]'
                : 'bg-white/90 hover:bg-white text-slate-600 border border-purple-100/70 shadow-sm hover:border-purple-200'
            }`}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
};
