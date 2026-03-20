export function getCurrentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${quarter} ${year}`;
}

export function sortQuarters(quarters) {
  return quarters.sort((a, b) => {
    const aMatch = a.match(/Q(\d) (\d{4})/);
    const bMatch = b.match(/Q(\d) (\d{4})/);
    
    if (!aMatch || !bMatch) return 0;
    
    const aYear = parseInt(aMatch[2]);
    const aQuarter = parseInt(aMatch[1]);
    const bYear = parseInt(bMatch[2]);
    const bQuarter = parseInt(bMatch[1]);
    
    if (aYear !== bYear) return aYear - bYear;
    return aQuarter - bQuarter;
  });
}