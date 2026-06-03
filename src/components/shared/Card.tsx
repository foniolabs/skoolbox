import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export default function Card({
  children,
  className = '',
  onClick,
  hover = false,
}: CardProps) {
  return (
    <div
      className={`bg-white rounded-xl shadow-sm p-6 ${
        hover
          ? 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer'
          : ''
      } ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
