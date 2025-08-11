'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { History, Search, Filter, Calendar, ArrowUpDown } from 'lucide-react';
import type { CinematographerVideo } from '@/actions/database/cinematographer-database';
import { TabContentWrapper, TabBody } from '@/components/tools/tab-content-wrapper';
// import { Button } from '@/components/ui/button';

interface HistoryTabProps {
  videos: CinematographerVideo[];
  isLoading: boolean;
  onRefresh: () => void;
}

/**
 * History Tab - Filter controls for video generation history
 * Left panel shows filters, right panel shows the actual history list
 * Following exact Thumbnail Machine pattern
 */
export function HistoryTab({ videos, isLoading: _isLoading, onRefresh: _onRefresh }: HistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [dateRange, setDateRange] = useState('all');

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
          <p className="text-zinc-400 font-medium">Filter and search your video generation history</p>
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
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Videos</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div>
            <Label className="text-base font-medium mb-2 block flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Date Range
            </Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sort Order - Full Width for Balance */}
        <div>
          <Label className="text-base font-medium mb-2 block flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            Sort Order
          </Label>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="duration">By Duration</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <Card className="p-6 space-y-6 border border-border/50">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Generation Stats</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Total:</span>
                <span className="ml-1 font-medium">{videos.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Completed:</span>
                <span className="ml-1 font-medium text-blue-600">
                  {videos.filter(v => v.status === 'completed').length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Processing:</span>
                <span className="ml-1 font-medium text-blue-600">
                  {videos.filter(v => v.status === 'processing').length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Failed:</span>
                <span className="ml-1 font-medium text-red-600">
                  {videos.filter(v => v.status === 'failed').length}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Active Filters */}
        {(searchTerm || filterType !== 'all' || dateRange !== 'all' || sortOrder !== 'newest') && (
          <Card className="p-6 space-y-6  border border-border/50">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Active Filters</h4>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('all');
                    setDateRange('all');
                    setSortOrder('newest');
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear All
                </button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                {searchTerm && <div>Search: &quot;{searchTerm}&quot;</div>}
                {filterType !== 'all' && <div>Status: {filterType}</div>}
                {dateRange !== 'all' && <div>Date: {dateRange}</div>}
                {sortOrder !== 'newest' && <div>Sort: {sortOrder}</div>}
              </div>
            </div>
          </Card>
        )}
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