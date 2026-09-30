import React from 'react';
import { RiApps2Line, RiEmotionHappyLine } from 'react-icons/ri';
import { GiGuitar } from 'react-icons/gi';
import { MdSportsTennis } from 'react-icons/md';
import { FaMasksTheater } from 'react-icons/fa6';

interface CategoryFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const categories = [
  { id: 'all', label: 'All', icon: RiApps2Line },
  { id: 'concerts', label: 'Concerts', icon: GiGuitar },
  { id: 'sports', label: 'Sports', icon: MdSportsTennis },
  { id: 'theatre', label: 'Theatre', icon: FaMasksTheater },
  { id: 'social', label: 'Comedy', icon: RiEmotionHappyLine },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex items-center gap-2.5 overflow-x-auto py-1 no-scrollbar">
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isActive =
          selectedCategory === cat.id ||
          (selectedCategory === 'all' && cat.id === 'all');

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex flex-col items-center justify-center p-2.5 rounded-2xl min-w-[68px] flex-1 transition-all duration-200 ${
              isActive
                ? 'bg-[#BCE859]/15 border-2 border-[#A8E443] text-[#A8E443] shadow-xs'
                : 'bg-dark-800 border border-dark-700 text-zinc-400 hover:text-white hover:border-dark-600'
            }`}
          >
            <Icon className={`w-5 h-5 mb-1.5 transition-colors ${isActive ? 'text-[#A8E443]' : 'text-zinc-400'}`} />
            <span className={`text-[11px] font-bold tracking-tight whitespace-nowrap ${isActive ? 'text-white' : 'text-zinc-400'}`}>
              {cat.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
