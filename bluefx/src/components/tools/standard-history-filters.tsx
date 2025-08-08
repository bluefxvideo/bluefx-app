'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, Filter, Calendar, ArrowUpDown } from 'lucide-react';
import { TabContentWrapper, TabHeader, TabBody } from '@/components/tools/tab-content-wrapper';

interface FilterOption {
  value: string;
  label: string;
}

interface StandardHistoryFiltersProps {
  toolName: string;
  toolTypes: FilterOption[];
  onFiltersChange: (filters: HistoryFilters) => void;
}

interface HistoryFilters {
  searchTerm: string;
  filterType: string;
  sortOrder: string;
  dateRange: string;
}

/**
 * StandardHistoryFilters - Uniform history filter component used across ALL BlueFX tools
 * Provides consistent filter controls for generation history
 */
export function StandardHistoryFilters({ 
  toolName,
  toolTypes,
  onFiltersChange 
}: StandardHistoryFiltersProps) {
  const [filters, setFilters] = useState<HistoryFilters>({
    searchTerm: '',
    filterType: 'all',
    sortOrder: 'newest',
    dateRange: 'all'
  });

  const updateFilters = (newFilters: Partial<HistoryFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  return (
    <TabContentWrapper>
      {/* Header */}
      <TabHeader
        icon={History}
        title="History Filters"
        description={`Filter and search your ${toolName} history`}
      />

      {/* Filter Controls */}
      <TabBody>
        {/* Search */}
        <div className="px-1">
          <Label className="text-base font-medium mb-2 block flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            Search
          </Label>
          <Input
            placeholder="Search by prompt, keywords, or type..."
            value={filters.searchTerm}
            onChange={(e) => updateFilters({ searchTerm: e.target.value })}
          />
        </div>

        {/* Type Filter */}
        <div>
          <Label className="text-base font-medium mb-2 block flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            Tool Type
          </Label>
          <Select value={filters.filterType} onValueChange={(value) => updateFilters({ filterType: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {toolTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div>
          <Label className="text-base font-medium mb-2 block flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Date Range
          </Label>
          <Select value={filters.dateRange} onValueChange={(value) => updateFilters({ dateRange: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Order */}
        <div>
          <Label className="text-base font-medium mb-2 block flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            Sort By
          </Label>
          <Select value={filters.sortOrder} onValueChange={(value) => updateFilters({ sortOrder: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
              <SelectItem value="type">By Type</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TabBody>
    </TabContentWrapper>
  );
}