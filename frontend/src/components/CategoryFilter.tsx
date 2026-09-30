import React from 'react';

interface CategoryFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const categories = [
  { id: 'all', label: 'All Categories' },
  { id: 'concerts', label: 'Music Concerts' },
  { id: 'festivals', label: 'Festivals' },
  { id: 'cinema', label: 'Cinema' },
  { id: 'sports', label: 'Sports' },
  { id: 'social', label: 'Workshops & Events' },
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
