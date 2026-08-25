import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CategoryFilter } from './components/CategoryFilter';
import { EventCard } from './components/EventCard';
import { EventDetailModal } from './components/EventDetailModal';
import { WaitingRoomModal } from './components/WaitingRoomModal';
import { CheckoutModal } from './components/CheckoutModal';
import { AuthModal } from './components/AuthModal';
import { ProfilePage } from './components/ProfilePage';
import { TicketsPage } from './components/TicketsPage';
import { CreateEventPage } from './components/CreateEventPage';
import { AdminDashboard } from './components/AdminDashboard';
import { api, type Event, type User } from './lib/api';
import { subscribeStock } from './lib/ws';
import { RiHome5Fill, RiUser3Line } from 'react-icons/ri';
import { FiShield } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { CgSpinner } from 'react-icons/cg';

type AppView = 'home' | 'admin' | 'profile' | 'tickets' | 'create_event';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState<AppView>('home');

  // Modals state (For War Ticket & Auth)
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isWaitingRoomOpen, setIsWaitingRoomOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
      } catch (e) {
        console.error(e);
      }
    }
    fetchEvents();
  }, []);

  // Reset admin views if not admin
  useEffect(() => {
    if (!isAdmin && (currentView === 'admin' || currentView === 'create_event')) {
      setCurrentView('home');
    }
  }, [user, isAdmin, currentView]);

  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const data = await api.getEvents();
      setEvents(data);
    } catch (e) {
      console.error('Failed to fetch events:', e);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // 📡 SUBSCRIBE TO REAL-TIME STOCK UPDATES VIA WEBSOCKET
  useEffect(() => {
    if (events.length === 0) return;

    const unsubscribers = events.map((event) => {
      return subscribeStock(event.id, (updatedEvent) => {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === updatedEvent.id
              ? { ...e, availableStock: updatedEvent.availableStock, status: updatedEvent.status }
              : e
          )
        );

        setSelectedEvent((prev) => (prev?.id === updatedEvent.id ? { ...prev, availableStock: updatedEvent.availableStock } : prev));
      });
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [events.length]);

  const handleLoginSuccess = (loggedInUser: User, token: string) => {
    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    localStorage.setItem('token', token);
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('home');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const handleWarTicket = (event: Event) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    setSelectedEvent(event);
    setIsDetailOpen(false);
    setIsWaitingRoomOpen(true);
  };

  const handleViewDetail = (event: Event) => {
    setSelectedEvent(event);
    setIsDetailOpen(true);
  };

  const handleAdmitted = () => {
    setIsWaitingRoomOpen(false);
    setIsCheckoutOpen(true);
  };

  const filteredEvents = events.filter((e) => {
    const desc = e.description || '';
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || desc.toLowerCase().includes(searchQuery.toLowerCase());
    const eventCategory = (e.category || 'concerts').toLowerCase();
    const matchesCategory = selectedCategory === 'all' || eventCategory === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#EFE5FB] text-slate-900 font-sans">
      <div className="max-w-md mx-auto min-h-screen bg-[#FBF9FE] shadow-lg shadow-purple-500/5 relative flex flex-col justify-between pb-28">
        <div>
          {/* 1. 👤 FULL PAGE: PROFIL & EDIT PROFIL */}
          {currentView === 'profile' ? (
            <ProfilePage
              user={user}
              onBack={() => setCurrentView('home')}
              onLogout={handleLogout}
              onNavigateTickets={() => setCurrentView('tickets')}
              onUpdateUser={(updated) => {
                setUser(updated);
                localStorage.setItem('user', JSON.stringify(updated));
              }}
            />
          ) : currentView === 'tickets' ? (
            /* 2. 🎟️ FULL PAGE: TIKET SAYA */
            <TicketsPage
              user={user}
              onBack={() => setCurrentView('home')}
              onExplore={() => setCurrentView('home')}
              events={events}
            />
          ) : currentView === 'create_event' ? (
            /* 3. ➕ FULL PAGE: TAMBAH EVENT FLASH SALE BARU */
            <CreateEventPage
              onBack={() => setCurrentView('admin')}
              onSuccess={() => {
                fetchEvents();
                setCurrentView('admin');
              }}
            />
          ) : (
            /* 4. 📄 PAGES WITH TOP HEADER (HOME / ADMIN DASHBOARD) */
            <>
              <Header
                user={user}
                onOpenAuth={() => setIsAuthOpen(true)}
                onLogout={handleLogout}
                isAdminView={currentView === 'admin'}
                onToggleAdmin={() => setCurrentView(currentView === 'admin' ? 'home' : 'admin')}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />

              {isAdmin && currentView === 'admin' ? (
                /* 📊 ADMIN CONSOLE PAGE VIEW */
                <main className="px-4 py-4 space-y-4 animate-fadeIn">
                  <AdminDashboard
                    events={events}
                    onRefreshEvents={fetchEvents}
                    onNavigateCreateEvent={() => setCurrentView('create_event')}
                  />
                </main>
              ) : (
                /* 🎟️ USER EXPERIENCE HOME PAGE VIEW */
                <main className="px-4 py-4 space-y-4 animate-fadeIn">
                  <CategoryFilter
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                  />

                  <div className="flex items-center justify-between px-1 pt-1">
                    <h2 className="text-base font-extrabold text-slate-900">
                      Upcoming Events
                    </h2>
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className="text-xs font-bold text-slate-400 hover:text-app-purple transition-colors"
                    >
                      See All
                    </button>
                  </div>

                  {isLoadingEvents ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <CgSpinner className="w-8 h-8 text-app-purple animate-spin" />
                      <span className="text-xs font-bold text-slate-400">Loading live flash sale events...</span>
                    </div>
                  ) : filteredEvents.length === 0 ? (
                    <div className="bg-white rounded-[32px] p-8 text-center border border-purple-100 shadow-sm">
                      <p className="text-xs font-bold text-slate-400">No active flash sale events found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredEvents.map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          onWarTicket={handleWarTicket}
                          onViewDetail={handleViewDetail}
                        />
                      ))}
                    </div>
                  )}
                </main>
              )}
            </>
          )}
        </div>

        {/* 📱 Bottom Navigation Dock (Icon-Only & Uniform) */}
        <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-6 pointer-events-none">
          <div className="bg-white/95 backdrop-blur-2xl rounded-full p-2 shadow-dock border border-purple-100/90 flex items-center justify-around pointer-events-auto">
            {/* 1. Home Tab */}
            <button
              onClick={() => {
                setCurrentView('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                currentView === 'home'
                  ? 'bg-purple-btn text-white shadow-btn scale-105'
                  : 'text-slate-400 hover:text-app-purple hover:bg-purple-50'
              }`}
              title="Home"
            >
              <RiHome5Fill className="w-5 h-5" />
            </button>

            {/* 2. Admin Console Tab (Only visible for Admin Role) */}
            {isAdmin && (
              <button
                onClick={() => {
                  setCurrentView('admin');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                  currentView === 'admin' || currentView === 'create_event'
                    ? 'bg-purple-btn text-white shadow-btn scale-105'
                    : 'text-slate-400 hover:text-app-purple hover:bg-purple-50'
                }`}
                title="Admin Dashboard"
              >
                <FiShield className="w-5 h-5" />
              </button>
            )}

            {/* 3. My Tickets Tab */}
            <button
              onClick={() => {
                if (user) {
                  setCurrentView('tickets');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  setIsAuthOpen(true);
                }
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                currentView === 'tickets'
                  ? 'bg-purple-btn text-white shadow-btn scale-105'
                  : 'text-slate-400 hover:text-app-purple hover:bg-purple-50'
              }`}
              title="My Tickets"
            >
              <HiTicket className="w-5 h-5" />
            </button>

            {/* 4. Profile & Edit Profile Tab */}
            <button
              onClick={() => {
                if (user) {
                  setCurrentView('profile');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  setIsAuthOpen(true);
                }
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                currentView === 'profile'
                  ? 'bg-purple-btn text-white shadow-btn scale-105'
                  : 'text-slate-400 hover:text-app-purple hover:bg-purple-50'
              }`}
              title={user ? 'Profile & Account Settings' : 'Sign In / Register'}
            >
              <RiUser3Line className="w-5 h-5" />
            </button>
          </div>
        </nav>
      </div>

      {/* Modals for War Ticket Flow */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      <EventDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        event={selectedEvent}
        onContinue={handleWarTicket}
      />

      <WaitingRoomModal
        isOpen={isWaitingRoomOpen}
        onClose={() => setIsWaitingRoomOpen(false)}
        event={selectedEvent}
        onAdmitted={handleAdmitted}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        event={selectedEvent}
        onSuccess={() => {
          fetchEvents();
        }}
      />
    </div>
  );
}

export default App;
