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
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              isActive
                ? 'bg-white text-dark-950 shadow-md'
                : 'bg-dark-800 text-zinc-400 border border-dark-700 hover:text-white hover:border-dark-600'
            }`}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
};
