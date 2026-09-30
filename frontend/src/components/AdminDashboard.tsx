import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiShield, FiUsers, FiDollarSign, FiActivity, FiRefreshCw, FiFileText, FiCheckCircle, FiXCircle, FiX, FiPlus, FiClock } from 'react-icons/fi';
import { HiTicket } from 'react-icons/hi2';
import { IoFlash } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { api, type Order, type Event, type OrderLog } from '../lib/api';

interface AdminDashboardProps {
  events: Event[];
  onRefreshEvents: () => void;
  onNavigateCreateEvent: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  events,
  onRefreshEvents,
  onNavigateCreateEvent,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id || '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [batchSize, setBatchSize] = useState<number>(5);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isAdmitting, setIsAdmitting] = useState(false);
  const [gateMode, setGateMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [isTogglingMode, setIsTogglingMode] = useState(false);
  const [admitMsg, setAdmitMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFIRMED' | 'PENDING' | 'FAILED'>('ALL');

  const [selectedOrderLogs, setSelectedOrderLogs] = useState<OrderLog[] | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events]);

  const fetchGateMode = async () => {
    if (!selectedEventId) return;
    try {
      const mode = await api.getGateMode(selectedEventId);
      setGateMode(mode);
    } catch (e) {
      // Default to AUTO
    }
  };

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await api.getAllOrders(selectedEventId ? selectedEventId : undefined);
      setOrders(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchGateMode();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [selectedEventId]);

  const handleToggleGateMode = async (newMode: 'AUTO' | 'MANUAL') => {
    if (!selectedEventId || isTogglingMode || gateMode === newMode) return;
    setIsTogglingMode(true);
    setAdmitMsg(null);
    try {
      const updated = await api.setGateMode(selectedEventId, newMode);
      setGateMode(updated);
      setAdmitMsg({
        type: 'success',
        text:
          newMode === 'AUTO'
            ? '🟢 Auto-Pass mode activated: Users can book directly without waiting in queue.'
            : '🔴 Traffic Surge mode activated: Users will queue in Waiting Room until admitted.',
      });
    } catch (e: any) {
      setAdmitMsg({ type: 'error', text: e.message || 'Failed to update gate mode' });
    } finally {
      setIsTogglingMode(false);
    }
  };

  const handleAdmit = async () => {
    if (!selectedEventId) return;
    setIsAdmitting(true);
    setAdmitMsg(null);
    try {
      const count = await api.admitUsers(selectedEventId, batchSize);
      setAdmitMsg({
        type: 'success',
        text: `Successfully admitted ${count} users from waiting room to checkout desk`,
      });
      onRefreshEvents();
    } catch (e: any) {
      setAdmitMsg({ type: 'error', text: `Failed: ${e.message}` });
    } finally {
      setIsAdmitting(false);
    }
  };

  const handleViewLogs = async (orderId: string) => {
    setSelectedOrderId(orderId);
    try {
      const logs = await api.getOrderLogs(orderId);
      setSelectedOrderLogs(logs);
    } catch (e) {
      console.error(e);
    }
  };

  const currentEvent = events.find((e) => e.id === selectedEventId);
  const totalRevenue = orders.reduce((sum, o) => (o.status === 'CONFIRMED' ? sum + o.totalPrice : sum), 0);
  const totalSold = orders.filter((o) => o.status === 'CONFIRMED').length;
  const pendingOrders = orders.filter((o) => o.status === 'PENDING').length;

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'ALL') return true;
    return o.status === statusFilter;
  });

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(p);
  };

  const getStepMeta = (eventType: string) => {
    switch (eventType) {
      case 'ORDER_CREATED':
        return {
          title: 'Order Created',
          desc: 'Request validated and message published to RabbitMQ queue',
          icon: <HiTicket className="w-4 h-4 text-purple-600" />,
          dotBg: 'bg-purple-500',
          badgeClass: 'bg-purple-100 text-purple-700 border-purple-200',
        };
      case 'STOCK_RESERVED':
        return {
          title: 'Stock Reserved in Redis',
          desc: 'Lua script atomically deducted in-memory quota (0% race condition)',
          icon: <IoFlash className="w-4 h-4 text-amber-600" />,
          dotBg: 'bg-amber-500',
          badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
        };
      case 'ORDER_CONFIRMED':
        return {
          title: 'Order Confirmed',
          desc: 'Worker pool processed order and persisted to PostgreSQL database',
          icon: <FiCheckCircle className="w-4 h-4 text-emerald-600" />,
          dotBg: 'bg-emerald-500',
          badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        };
      case 'ORDER_FAILED':
        return {
          title: 'Order Failed',
          desc: 'Order processing failed and stock was rolled back to Redis RAM',
          icon: <FiXCircle className="w-4 h-4 text-red-600" />,
          dotBg: 'bg-red-500',
          badgeClass: 'bg-red-100 text-red-700 border-red-200',
        };
      default:
        return {
          title: eventType,
          desc: 'Lifecycle event log',
          icon: <FiActivity className="w-4 h-4 text-slate-600" />,
          dotBg: 'bg-slate-500',
          badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Event Selector & Quick Action Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <FiShield className="w-4 h-4 text-indigo-600" />
            <span>Select Flash Sale Event</span>
          </div>
          <button
            onClick={() => {
              fetchOrders();
              onRefreshEvents();
            }}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
            title="Reload Data"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer mb-2.5"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} (Stock: {e.availableStock}/{e.totalStock})
            </option>
          ))}
        </select>

        {/* ➕ Navigate to Create Event Page */}
        <button
          onClick={onNavigateCreateEvent}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
        >
          <FiPlus className="w-3.5 h-3.5" />
          <span>Create New Flash Sale Event</span>
        </button>
      </div>

      {/* 2x2 Mobile KPI Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Card 1: Tickets Sold */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tickets Sold</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <HiTicket className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-900 leading-none mb-1">
              {totalSold} <span className="text-[11px] text-slate-400 font-semibold">/ {currentEvent?.totalStock || 0}</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
              <FiCheckCircle className="w-3 h-3" /> Stock Controlled
            </span>
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FiDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-base font-extrabold text-slate-900 leading-none mb-1 truncate">
              {formatPrice(totalRevenue)}
            </div>
            <span className="text-[10px] font-medium text-slate-500 block">
              Recorded in PostgreSQL
            </span>
          </div>
        </div>

        {/* Card 3: Redis Live Stock */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Redis In-Memory Stock</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FiActivity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-900 leading-none mb-1">
              {currentEvent?.availableStock || 0} <span className="text-[11px] text-slate-400 font-semibold">Tickets</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 block">
              Atomic Lua Quota
            </span>
          </div>
        </div>

        {/* Card 4: DB Queue */}
        <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Worker Queue</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FiUsers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-slate-900 leading-none mb-1">
              {pendingOrders} <span className="text-[11px] text-slate-400 font-semibold">Pending</span>
            </div>
            <span className="text-[10px] font-semibold text-blue-700 block">
              10 RabbitMQ Consumers
            </span>
          </div>
        </div>
      </div>

      {/* 🎟️ WAITING ROOM ADMISSION GATEKEEPER & MODE SWITCH CARD */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
        {/* Header with Live Status Tag */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <FiUsers className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 leading-tight">
                Queue Gatekeeper
              </h3>
              <p className="text-[10px] text-slate-500">
                Traffic pacing for waiting room & checkout
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
              gateMode === 'AUTO'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                gateMode === 'AUTO' ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
              }`}
            ></span>
            <span>{gateMode === 'AUTO' ? 'Auto-Pass' : 'Surge Queue'}</span>
          </span>
        </div>

        {/* 🔄 MODE TOGGLE SWITCH: AUTO-PASS VS SURGE QUEUE */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
          <button
            type="button"
            disabled={isTogglingMode}
            onClick={() => handleToggleGateMode('AUTO')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              gateMode === 'AUTO'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                gateMode === 'AUTO' ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            ></span>
            <span>Auto-Pass (Direct)</span>
          </button>

          <button
            type="button"
            disabled={isTogglingMode}
            onClick={() => handleToggleGateMode('MANUAL')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              gateMode === 'MANUAL'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                gateMode === 'MANUAL' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'
              }`}
            ></span>
            <span>Surge Gate (Paced)</span>
          </button>
        </div>

        {/* 🟢 IF AUTO-PASS IS ACTIVE: Show Status Info */}
        {gateMode === 'AUTO' ? (
          <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-100 flex items-center gap-2.5 animate-fadeIn">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FiCheckCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-900">Direct Checkout Active</h4>
              <p className="text-[10px] text-emerald-700 font-medium leading-tight">
                Users enter checkout directly without waiting in the virtual waiting room.
              </p>
            </div>
          </div>
        ) : (
          /* 🔴 IF SURGE QUEUE IS ACTIVE: Show Manual Batch Release Controls */
          <div className="space-y-3 pt-1 animate-fadeIn">
            {/* Preset Quick Batch Buttons */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-1.5">
                <span>Select Admission Batch:</span>
                <span className="text-indigo-600 font-extrabold">{batchSize} Users / Batch</span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[5, 10, 25, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBatchSize(preset)}
                    className={`py-1 rounded-lg text-xs font-bold transition-all border text-center ${
                      batchSize === preset
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    +{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Stepper + Big Action Button */}
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  onClick={() => setBatchSize(Math.max(1, batchSize - 5))}
                  className="w-7 h-7 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center text-xs shadow-xs border border-slate-200"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={batchSize}
                  onChange={(e) =>
                    setBatchSize(Math.max(1, Math.min(100, Number(e.target.value))))
                  }
                  className="w-9 bg-transparent text-xs font-bold text-center text-slate-800 outline-none"
                />
                <button
                  onClick={() => setBatchSize(Math.min(100, batchSize + 5))}
                  className="w-7 h-7 rounded-lg bg-white text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center text-xs shadow-xs border border-slate-200"
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAdmit}
                disabled={isAdmitting || !selectedEventId}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isAdmitting ? (
                  <>
                    <CgSpinner className="w-4 h-4 animate-spin" />
                    <span>Admitting Queue...</span>
                  </>
                ) : (
                  <>
                    <IoFlash className="w-4 h-4 text-amber-300" />
                    <span>Admit {batchSize} Users to Checkout</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {admitMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 animate-fadeIn ${
              admitMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {admitMsg.type === 'success' ? (
              <FiCheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <FiXCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{admitMsg.text}</span>
          </div>
        )}
      </div>

      {/* Real-Time Orders List (Mobile Cards) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Incoming Orders ({filteredOrders.length})
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['ALL', 'CONFIRMED', 'PENDING'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-200 shadow-sm">
            <p className="text-xs font-medium text-slate-400">No orders found with status {statusFilter}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map((o) => (
              <div
                key={o.id}
                className="bg-white rounded-xl p-3 border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-700 truncate max-w-[120px]">
                      {o.id}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        o.status === 'CONFIRMED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : o.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          o.status === 'CONFIRMED'
                            ? 'bg-emerald-500'
                            : o.status === 'PENDING'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      ></span>
                      {o.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{o.quantity} Tickets</span>
                    <span>•</span>
                    <span className="font-bold text-slate-800">{formatPrice(o.totalPrice)}</span>
                    <span>•</span>
                    <span>{new Date(o.createdAt).toLocaleTimeString('en-US')}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleViewLogs(o.id)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-semibold border border-slate-200 flex items-center gap-1 shrink-0 transition-colors"
                >
                  <FiFileText className="w-3 h-3" />
                  <span>Logs</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🔍 SIMPLE & CLEAN AUDIT TRAIL MODAL WITH FULL SCREEN BACKDROP VIA PORTAL */}
      {selectedOrderLogs &&
        createPortal(
          <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
            <div className="relative w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col justify-between overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <FiFileText className="w-4 h-4 text-indigo-600" />
                    <span>Audit Trail Logs</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[220px]">
                    Order ID: {selectedOrderId}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedOrderLogs(null)}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              {/* Simple Log Items List */}
              <div className="overflow-y-auto no-scrollbar flex-1 py-3 space-y-2">
                {selectedOrderLogs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs font-medium">
                    No audit logs recorded for this order yet.
                  </div>
                ) : (
                  selectedOrderLogs.map((log, index) => {
                    const meta = getStepMeta(log.eventType);
                    return (
                      <div
                        key={log.id}
                        className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[10px] text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                            {index + 1}. {log.eventType}
                          </span>
                          <span className="text-[10px] font-medium text-slate-500 flex items-center gap-0.5">
                            <FiClock className="w-2.5 h-2.5" />
                            {new Date(log.createdAt).toLocaleTimeString('en-US')}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 font-normal leading-relaxed pt-0.5">
                          {meta.desc}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => setSelectedOrderLogs(null)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Close Audit Trail
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
