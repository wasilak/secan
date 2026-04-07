// Quick test for getColorForIndex behaviour
function getColorForIndex(indexName, separateSystemIndexColors = true) {
  if (!indexName) return 'var(--mantine-color-gray-6)';
  const isSystem = indexName.startsWith('.');
  let working = isSystem ? indexName.slice(1) : indexName;
  working = working.replace(/(?:-\d+(?:[.\-]\d+)*)+$/, '');
  if (!working) working = isSystem ? indexName.slice(1) : indexName;
  const key = separateSystemIndexColors && isSystem ? '.' + working : working;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
  }
  const colors = [
    'var(--mantine-color-blue-6)',
    'var(--mantine-color-cyan-6)',
    'var(--mantine-color-violet-6)',
    'var(--mantine-color-pink-6)',
    'var(--mantine-color-green-6)',
    'var(--mantine-color-yellow-6)',
    'var(--mantine-color-orange-6)',
    'var(--mantine-color-red-6)',
  ];
  return colors[Math.abs(hash) % colors.length];
}

const names = [
  'my-index-2026.02.03',
  'my-index-2026.02.03-232320',
  'my-index-232320',
  '.my-index',
  'another-index-2026.02.03',
  'another-index-2026.02.03-232320',
  'another-index-232320',
  '.another-index',
  'my-index',
];

console.log('=== separateSystem = false (group .my-index with my-index) ===');
names.forEach((n) => console.log(n + ' -> ' + getColorForIndex(n, false)));

console.log('\n=== separateSystem = true (treat .my-index separately) ===');
names.forEach((n) => console.log(n + ' -> ' + getColorForIndex(n, true)));

// Also show unique keys for clarity
console.log('\n=== derived keys (for separateSystem=false) ===');
names.forEach((n) => {
  const isSystem = n.startsWith('.');
  const working = (isSystem ? n.slice(1) : n).replace(/(?:-\d+(?:[.\-]\d+)*)+$/, '') || (isSystem ? n.slice(1) : n);
  const key = false && isSystem ? '.' + working : working;
  console.log(n + ' -> key=' + key);
});
