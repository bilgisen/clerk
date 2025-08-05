"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";
export function DataTableToolbar({ table, filterColumn, }) {
    return (<div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Search books..." value={table.getColumn(filterColumn)?.getFilterValue() ?? ""} onChange={(event) => table.getColumn(filterColumn)?.setFilterValue(event.target.value)} className="h-9 w-[150px] pl-8 md:w-[250px] lg:w-[300px]"/>
        </div>
      </div>
      <DataTableViewOptions table={table}/>
    </div>);
}
