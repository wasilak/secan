import type { ReactNode } from 'react';

export interface FilterOption {
  label: string;
  value: string;
  color?: string;
  icon?: ReactNode;
}

export interface FilterCategory {
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  defaultValue?: string[];
}

export interface TextFilterConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface ToggleConfig {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: ReactNode;
}

export interface ActionConfig {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: 'filled' | 'outline' | 'subtle';
}

export interface ConditionalSectionConfig {
  visible: boolean;
  content: ReactNode;
}

export interface FilterSidebarProps {
  textFilters?: TextFilterConfig[];
  categories?: FilterCategory[];
  conditionalSections?: ConditionalSectionConfig[];
  toggles?: ToggleConfig[];
  actions?: ActionConfig[];
  defaultExpanded?: boolean;
  width?: number;
}

export interface FilterCategoryProps {
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  allValues?: string[];
}

export interface TextSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export interface ToggleFilterProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}
