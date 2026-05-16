"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMonthDayBD } from "@/lib/format/datetime";

export function DashboardDateRangePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [tempFrom, setTempFrom] = useState(from || "");
  const [tempTo, setTempTo] = useState(to || "");

  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (tempFrom) params.set("from", tempFrom);
    else params.delete("from");
    
    if (tempTo) params.set("to", tempTo);
    else params.delete("to");
    
    router.push(`/dashboard?${params.toString()}`);
  };

  const handleQuickRange = (range: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    switch (range) {
      case "today":
        start.setHours(0, 0, 0, 0);
        break;
      case "this_week":
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        break;
      case "this_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "last_30_days":
        start.setDate(now.getDate() - 30);
        break;
    }
    
    const fromStr = start.toISOString().split("T")[0];
    const toStr = end.toISOString().split("T")[0];
    
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", fromStr);
    params.set("to", toStr);
    router.push(`/dashboard?${params.toString()}`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return formatMonthDayBD(dateStr);
  };

  const getYear = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).getFullYear();
  };

  const displayRange = from && to 
    ? `${formatDate(from)} - ${formatDate(to)}, ${getYear(to)}` 
    : "This Month";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between rounded-full border-slate-200 bg-white px-4 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 sm:w-auto">
          <CalendarIcon className="mr-2 size-4 text-slate-500 dark:text-slate-400" />
          <span className="truncate text-left text-sm font-medium text-slate-700 dark:text-slate-200">{displayRange}</span>
          <ChevronDown className="ml-2 size-4 text-slate-400 dark:text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(20rem,calc(100vw-1rem))] rounded-2xl border-slate-200 p-4 shadow-lg dark:border-slate-800 dark:bg-slate-950">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="sm" className="justify-start text-xs rounded-lg" onClick={() => handleQuickRange("today")}>Today</Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs rounded-lg" onClick={() => handleQuickRange("this_week")}>This Week</Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs rounded-lg" onClick={() => handleQuickRange("this_month")}>This Month</Button>
            <Button variant="ghost" size="sm" className="justify-start text-xs rounded-lg" onClick={() => handleQuickRange("last_30_days")}>Last 30 Days</Button>
          </div>
          
          <div className="h-px bg-slate-100 dark:bg-slate-800" />
          
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">From Date</Label>
              <Input 
                type="date" 
                value={tempFrom} 
                onChange={(e) => setTempFrom(e.target.value)}
                className="h-9 rounded-lg text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">To Date</Label>
              <Input 
                type="date" 
                value={tempTo} 
                onChange={(e) => setTempTo(e.target.value)}
                className="h-9 rounded-lg text-xs"
              />
            </div>
            <Button className="w-full h-9 rounded-lg text-xs font-semibold" onClick={handleApply}>
              Apply Range
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
