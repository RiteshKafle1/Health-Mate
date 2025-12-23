import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useState } from 'react';
import { Menu } from 'lucide-react';

export function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-gradient-dark">
            <Navbar />

            {/* Mobile sidebar toggle */}
            <button
                className="fixed bottom-4 right-4 z-30 md:hidden p-4 btn-primary rounded-full shadow-lg"
                onClick={() => setSidebarOpen(true)}
            >
                <Menu size={24} />
            </button>

            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main content */}
            <main className="md:ml-64 min-h-[calc(100vh-4rem)]">
                <div className="p-4 md:p-8">
                    <div className="page-enter">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
}
