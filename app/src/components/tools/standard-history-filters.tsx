'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, Filter, Calendar, ArrowUpDown } from 'lucide-react';
import { TabContentWrapper, TabBody } from '@/components/tools/tab-content-wrapper';

interface FilterOption {
  value: string;
  label: string;
}

interface StandardHistoryFiltersProps {
  toolName: string;
  toolTypes: FilterOption[];
  onFiltersChange: (filters: HistoryFilters) => void;
}

export interface HistoryFilters {
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
      {/* Header - Match StandardStep Layout */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center transition-all duration-300">
            <History className="w-5 h-5 text-white" />
          </div>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white mb-1 tracking-tight">History Filters</h3>
          <p className="text-zinc-400 font-medium">Filter and search your {toolName} history</p>
        </div>
      </div>

      {/* Filter Controls */}
      <TabBody>
        {/* Search - Full Width */}
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

        {/* Filters Grid - 2 Columns */}
        <div className="grid grid-cols-2 gap-6">
          {/* Tool Type */}
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
        </div>

        {/* Sort By - Full Width for Balance */}
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

      {/* Apply Filters Info */}
      <div className="mt-6 pt-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Filters are applied to the history display on the right panel
        </p>
      </div>
    </TabContentWrapper>
  );
}