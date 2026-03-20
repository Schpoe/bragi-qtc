import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Users, FolderKanban, CalendarRange, BarChart3, Menu, X, Trash2, Shield, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { isAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const navItems = [
  { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
  { name: "Teams", page: "Teams", icon: Users },
  { name: "Work Items", page: "WorkAreas", icon: FolderKanban },
  { name: "Work Item Types", page: "WorkAreaTypes", icon: FolderKanban },
  { name: "Sprint Planning", page: "SprintPlanning", icon: CalendarRange },
  { name: "Team Overview", page: "TeamSprintOverview", icon: BarChart3 },
  { name: "User Management", page: "UserManagement", icon: Shield, adminOnly: true },
  { name: "Cleanup", page: "Cleanup", icon: Trash2, adminOnly: true },
];

export default function Layout({ children, currentPageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  
  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || isAdmin(user)
  );

  // Session timeout - 30 minutes of inactivity
  useEffect(() => {
    let timeout;
    
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        base44.auth.logout();
      }, 30 * 60 * 1000); // 30 minutes
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetTimeout);
    });

    resetTimeout();

    return () => {
      clearTimeout(timeout);
      events.forEach(event => {
        document.removeEventListener(event, resetTimeout);
      });
    };
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card fixed h-full z-30">
        <div className="p-6 border-b border-border">
          <h1 className="text-lg font-bold text-foreground tracking-tight">
            Capacity<span className="text-primary">Planning</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Sprint & Quarter</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border space-y-3">
          <div className="px-3">
            <div className="text-xs text-muted-foreground">Logged in as</div>
            <div className="text-sm font-medium truncate">{user?.full_name || user?.email}</div>
            <div className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-40">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-bold ml-2">
          Kapazitäts<span className="text-primary">planung</span>
        </h1>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full bg-card border-r border-border flex flex-col">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h1 className="text-lg font-bold">
                Capacity<span className="text-primary">Planning</span>
              </h1>
              <button onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {filteredNavItems.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-border space-y-3">
              <div className="px-3">
                <div className="text-xs text-muted-foreground">Logged in as</div>
                <div className="text-sm font-medium truncate">{user?.full_name || user?.email}</div>
                <div className="text-xs text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</div>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-3" />
                Logout
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}