import { useState, useEffect, useCallback } from 'react';
import { TextInput, CloseButton } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { TextSearchInputProps } from './types';

export function TextSearchInput({
  value,
  onChange,
  placeholder = 'Filter by name...',
  debounceMs = 300,
}: TextSearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [localValue, debounceMs, onChange, value]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  return (
    <TextInput
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.currentTarget.value)}
      leftSection={<IconSearch size={16} />}
      rightSection={
        localValue ? (
          <CloseButton
            size="xs"
            aria-label="Clear search"
            onClick={handleClear}
          />
        ) : null
      }
      size="sm"
    />
  );
}
