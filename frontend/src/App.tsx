import { useState, useEffect, useRef } from 'react';
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
import { NotificationModal, type AppNotification } from './components/NotificationModal';
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

  // 🔔 Notifications State (Persisted in localStorage)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem('flash_sale_notifs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) }));
      } catch (e) {
        // Fallback
      }
    }
    return [
      {
        id: 'welcome-notif',
        title: 'Welcome to Flash Sale! 🎉',
        message: 'Explore upcoming live concert tickets and join flash sale waiting rooms.',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        type: 'stock_alert',
        read: false,
      },
    ];
  });

  // Ref to guarantee strictly 1-time execution per admission pass
  const alertedPassesRef = useRef<Set<string>>(new Set());

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    localStorage.setItem('flash_sale_notifs', JSON.stringify(notifications));
  }, [notifications]);

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

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc1.stop(ctx.currentTime + 0.6);
    } catch (e) {
      // Ignore if audio permissions blocked
    }
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Optional browser desktop notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(newNotif.title, { body: newNotif.message });
      } catch (e) {
        // Silently catch
      }
    }
  };

  // 🔔 SINGLE-SHOT ADMISSION DISPATCHER (Strictly 1x per pass)
  const notifyAdmission = (eventId: string, eventName?: string) => {
    const dedupeKey = `${user?.id || 'user'}_${eventId}`;
    if (alertedPassesRef.current.has(dedupeKey)) {
      return; // Already notified once!
    }
    alertedPassesRef.current.add(dedupeKey);

    // Clear active queued item
    localStorage.removeItem('activeQueueEventId');

    const name = eventName || 'the flash sale event';
    playChime();

    addNotification({
      title: "It's Your Turn! 🎉",
      message: `You've been admitted from the queue for ${name}! Your 5-minute checkout session is active.`,
      type: 'admitted',
      eventId,
    });
  };

  // 🔄 GLOBAL BACKGROUND QUEUE MONITOR
  useEffect(() => {
    if (!user) return;

    const checkQueue = async () => {
      const queuedId = localStorage.getItem('activeQueueEventId');
      if (!queuedId) return;

      const dedupeKey = `${user.id}_${queuedId}`;
      if (alertedPassesRef.current.has(dedupeKey)) {
        localStorage.removeItem('activeQueueEventId');
        return;
      }

      try {
        const status = await api.getQueueStatus(queuedId);
        if (status.isAllowedToPurchase) {
          const foundEvent = events.find((e) => e.id === queuedId);
          notifyAdmission(queuedId, foundEvent?.name);
        }
      } catch (e) {
        // Silently catch
      }
    };

    const interval = setInterval(checkQueue, 2500);
    return () => clearInterval(interval);
  }, [user, events]);

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
    localStorage.removeItem('activeQueueEventId');
    alertedPassesRef.current.clear();
  };

  const handleWarTicket = (event: Event) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    // Reset deduplication for this new queue entry
    const dedupeKey = `${user.id}_${event.id}`;
    alertedPassesRef.current.delete(dedupeKey);

    setSelectedEvent(event);
    localStorage.setItem('activeQueueEventId', event.id);
    setIsDetailOpen(false);
    setIsWaitingRoomOpen(true);
  };

  const handleViewDetail = (event: Event) => {
    setSelectedEvent(event);
    setIsDetailOpen(true);
  };

  const handleAdmitted = (wasWaiting: boolean = false) => {
    setIsWaitingRoomOpen(false);
    setIsCheckoutOpen(true);
    // ONLY send notification if the user was ACTUALLY waiting in queue!
    // Instant direct checkout pass does NOT spam notifications.
    if (wasWaiting && selectedEvent) {
      notifyAdmission(selectedEvent.id, selectedEvent.name);
    }
  };

  const filteredEvents = events.filter((e) => {
    const desc = e.description || '';
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || desc.toLowerCase().includes(searchQuery.toLowerCase());
    const eventCategory = (e.category || 'concerts').toLowerCase();
    const matchesCategory = selectedCategory === 'all' || eventCategory === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

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
              onOpenCheckout={(ev) => {
                setSelectedEvent(ev);
                setIsCheckoutOpen(true);
              }}
              onOpenWaitingRoom={(ev) => {
                setSelectedEvent(ev);
                setIsWaitingRoomOpen(true);
              }}
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
                onOpenNotifications={() => setIsNotificationsOpen(true)}
                unreadCount={unreadNotifsCount}
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

      {/* 🔔 Notification Bell Modal */}
      <NotificationModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
        onClearAll={() => setNotifications([])}
        onSelectNotification={(notif) => {
          setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)));
          if (notif.type === 'admitted') {
            const foundEvent = events.find((e) => e.id === notif.eventId) || events[0];
            if (foundEvent) {
              setSelectedEvent(foundEvent);
              setIsNotificationsOpen(false);
              setIsCheckoutOpen(true);
            }
          } else if (notif.type === 'order_confirmed') {
            setIsNotificationsOpen(false);
            setCurrentView('tickets');
          }
        }}
      />

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
          addNotification({
            title: 'Booking Confirmed! 🎫',
            message: `Your tickets for ${selectedEvent?.name || 'the event'} have been successfully confirmed and stored in your profile.`,
            type: 'order_confirmed',
            eventId: selectedEvent?.id,
          });
        }}
      />
    </div>
  );
}

export default App;
