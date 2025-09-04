'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, Filter, Calendar, ArrowUpDown } from 'lucide-react';
import { TabContentWrapper, TabBody } from '@/components/tools/tab-content-wrapper';

export interface MusicHistoryFilters {
  searchTerm: string;
  filterStatus: string;
  sortOrder: string;
  dateRange: string;
}

interface MusicHistoryFiltersProps {
  onFiltersChange: (filters: MusicHistoryFilters) => void;
}

/**
 * Music History Filters - Filter controls for music generation history
 * Follows the standardized history filter pattern
 */
export function MusicHistoryFilters({ onFiltersChange }: MusicHistoryFiltersProps) {
  const [filters, setFilters] = useState<MusicHistoryFilters>({
    searchTerm: '',
    filterStatus: 'all',
    sortOrder: 'newest',
    dateRange: 'all'
  });

  const updateFilters = (newFilters: Partial<MusicHistoryFilters>) => {
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
          <p className="text-zinc-400 font-medium">Filter and search your music history</p>
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
            placeholder="Search by prompt, description, or title..."
            value={filters.searchTerm}
            onChange={(e) => updateFilters({ searchTerm: e.target.value })}
          />
        </div>

        {/* Filters Grid - 2 Columns */}
        <div className="grid grid-cols-2 gap-6">
          {/* Status Filter */}
          <div>
            <Label className="text-base font-medium mb-2 block flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              Status
            </Label>
            <Select value={filters.filterStatus} onValueChange={(value) => updateFilters({ filterStatus: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
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
                <SelectItem value="week">Past Week</SelectItem>
                <SelectItem value="month">Past Month</SelectItem>
                <SelectItem value="quarter">Past Quarter</SelectItem>
                <SelectItem value="year">Past Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sort Order - Full Width */}
        <div className="px-1">
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
              <SelectItem value="name">Title (A-Z)</SelectItem>
              <SelectItem value="name_desc">Title (Z-A)</SelectItem>
              <SelectItem value="duration">Duration</SelectItem>
              <SelectItem value="credits">Credits Used</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TabBody>
    </TabContentWrapper>
  );
}