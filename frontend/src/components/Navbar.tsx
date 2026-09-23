import React, { useState, useEffect, useRef } from 'react';
import { ShoppingBag, Search, Menu, X, Heart, User, ChevronDown, ArrowRight, Bell, CheckCheck, Sparkles } from 'lucide-react';
import { CategorySlug } from '../types';
import { useRouter } from '../router/RouterContext';
import { useCart } from '../context/CartContext';
import { useStore } from '../context/StoreContext';
import { useWishlist } from '../context/WishlistContext';
import { useNotifications } from '../context/NotificationsContext';
import { Badge } from './ui/Badge';
import { motion, AnimatePresence } from 'motion/react';

const backendBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const modezaLogoUrl = `${backendBaseUrl}/static/images/logo.png`;

export interface NavbarProps {
  onOpenSearch?: () => void;
}

interface NavigationItem {
  label: string;
  path: string;
  slug?: CategorySlug;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSearch }) => {
  const { navigate, route } = useRouter();
  const { cartCount, openCartDrawer } = useCart();
  const { wishlistCount } = useWishlist();
  const { categories: storeCategories } = useStore();

  // State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derived data
  const categories: NavigationItem[] = storeCategories.map((category) => ({
    label: category.name,
    slug: category.slug as CategorySlug,
    path: category.slug === 'all' ? '/shop' : `/shop/${category.slug}`,
  }));

  const productCategories = categories.filter((cat) => cat.slug !== 'all');
  const currentCategory = route.path === '/shop' ? route.category || 'all' : undefined;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoriesOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navigation helpers
  const navigateFromShopMenu = (path: string) => {
    navigate(path);
    setIsCategoriesOpen(false);
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const navigateAndCloseMobile = (path: string) => {
    navigate(path);
    closeMobileMenu();
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsCategoriesOpen(false);
      setIsMobileMenuOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <header className="sticky top-0 z-[200]">
      {/* Announcement Bar */}
      <AnnouncementBar />

      {/* Main Navigation */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass sticky top-0 z-[200] border-b border-[#E8E5DF]/60"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex h-16 items-center justify-between sm:h-20">
            {/* Left Section */}
            <LeftNavigation
              isMobileMenuOpen={isMobileMenuOpen}
              onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              isCategoriesOpen={isCategoriesOpen}
              onToggleCategories={() => setIsCategoriesOpen(!isCategoriesOpen)}
              currentCategory={currentCategory}
              onNavigate={navigate}
              dropdownRef={dropdownRef}
              categories={productCategories}
              onNavigateFromShop={navigateFromShopMenu}
            />

            {/* Center Logo */}
            <CenterLogo onNavigate={navigate} />

            {/* Right Actions */}
            <RightActions
              onNavigate={navigate}
              onOpenSearch={onOpenSearch}
              onOpenCart={openCartDrawer}
              cartCount={cartCount}
              wishlistCount={wishlistCount}
            />
          </div>
        </div>
      </motion.div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <MobileMenu
            isOpen={isMobileMenuOpen}
            onClose={closeMobileMenu}
            onNavigate={navigateAndCloseMobile}
            categories={categories}
            productCategories={productCategories}
            currentCategory={currentCategory}
            cartCount={cartCount}
            wishlistCount={wishlistCount}
          />
        )}
      </AnimatePresence>
    </header>
  );
};

// Sub-components for better organization

const AnnouncementBar: React.FC = () => (
  <div className="bg-[#181716] px-4 py-2 relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-r from-[#181716] via-[#A2574F]/25 to-[#181716]" />
    <p className="relative text-[10px] uppercase tracking-[0.2em] text-[#FAF9F6] text-center font-medium">
      <Sparkles className="w-3 h-3 inline-block mr-1.5 text-[#E6C8CD]" />
      Free shipping on orders over KES 5,000
      <Sparkles className="w-3 h-3 inline-block ml-1.5 text-[#E6C8CD]" />
    </p>
  </div>
);

interface LeftNavigationProps {
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  isCategoriesOpen: boolean;
  onToggleCategories: () => void;
  currentCategory?: string;
  onNavigate: (path: string) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  categories: NavigationItem[];
  onNavigateFromShop: (path: string) => void;
}

const LeftNavigation: React.FC<LeftNavigationProps> = ({
  isMobileMenuOpen,
  onToggleMobileMenu,
  isCategoriesOpen,
  onToggleCategories,
  currentCategory,
  onNavigate,
  dropdownRef,
  categories,
  onNavigateFromShop,
}) => (
  <div className="flex shrink-0 items-center gap-4 sm:gap-6 lg:pl-[188px]">
    {/* Mobile Menu Button */}
    <button
      type="button"
      onClick={onToggleMobileMenu}
      className="lg:hidden flex items-center gap-2 text-[#181716] hover:text-[#A2574F] transition-colors p-2 rounded-full hover:bg-[#F3F1ED]"
      aria-label="Toggle menu"
      aria-expanded={isMobileMenuOpen}
    >
      {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
    </button>

    {/* Desktop Navigation */}
    <nav className="hidden items-center gap-7 lg:flex xl:gap-8" aria-label="Primary navigation">
      <NavButton label="Home" onClick={() => onNavigate('/')} />
      <NavButton
        label="New Arrivals"
        onClick={() => onNavigate('/shop?collection=new-arrivals')}
      />

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={onToggleCategories}
          className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold transition-colors px-2 py-1.5 rounded-full ${
            currentCategory
              ? 'text-[#A2574F] bg-[#F4ECE9]'
              : 'text-[#63605A] hover:text-[#181716] hover:bg-[#F3F1ED]'
          }`}
          aria-haspopup="menu"
          aria-expanded={isCategoriesOpen}
        >
          Categories
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCategoriesOpen ? 'rotate-180' : ''}`} />
        </button>

        {isCategoriesOpen && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 top-full z-[300] mt-2 w-[36rem] rounded-2xl border border-[#E8E5DF] bg-white p-6 shadow-2xl glass"
              role="menu"
            >
              <ShopDropdown
                categories={categories}
                onNavigate={onNavigateFromShop}
                onClose={() => onToggleCategories()}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <NavButton
        label="Collections"
        onClick={() => onNavigate('/shop')}
      />
      <NavButton label="Sale" onClick={() => onNavigate('/shop?sale=true')} />
    </nav>
  </div>
);

const NavButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="relative text-[10px] uppercase tracking-[0.18em] font-semibold text-[#63605A] hover:text-[#181716] transition-colors py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] focus-visible:ring-offset-4 after:absolute after:bottom-0 after:left-1/2 after:w-0 after:h-[2px] after:bg-[#A2574F] after:transition-all after:duration-200 hover:after:w-full hover:after:left-0"
  >
    {label}
  </button>
);

const ShopDropdown: React.FC<{
  categories: NavigationItem[];
  onNavigate: (path: string) => void;
  onClose: () => void;
}> = ({ categories, onNavigate, onClose }) => (
  <>
  <div className="grid grid-cols-3 gap-6">
    {/* Shop Links */}
    <DropdownColumn title="Shop">
      <DropdownLink label="All Products" onClick={() => onNavigate('/shop')} icon={<Sparkles className="w-3.5 h-3.5" />} />
      <DropdownLink label="Best Sellers" onClick={() => onNavigate('/shop?collection=best-sellers')} />
      <DropdownLink label="New Arrivals" onClick={() => onNavigate('/shop?collection=new-arrivals')} />
    </DropdownColumn>

    {/* Categories - use dynamic categories only to avoid duplicates */}
    <DropdownColumn title="Shop by Category">
      <DropdownLink label="All Products" onClick={() => onNavigate('/shop')} />
      {categories.map((cat) => (
        <DropdownLink
          key={cat.slug}
          label={cat.label}
          onClick={() => onNavigate(cat.path)}
        />
      ))}
    </DropdownColumn>

    {/* Occasions */}
    <DropdownColumn title="Shop by Occasion">
      <DropdownLink label="Everyday" onClick={() => onNavigate('/shop?occasion=everyday')} />
      <DropdownLink label="Evening" onClick={() => onNavigate('/shop?occasion=evening')} />
      <DropdownLink label="Special Occasions" onClick={() => onNavigate('/shop?occasion=special-occasions')} />
    </DropdownColumn>
  </div>

    {/* Featured CTA */}
  <div className="mt-6 pt-4 border-t border-[#E8E5DF]">
    <button
      type="button"
      onClick={() => onNavigate('/shop?collection=new-arrivals')}
      className="group flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-[#FAF9F6] hover:bg-[#F4ECE9] transition-colors border border-[#E8E5DF]"
    >
      <span className="text-xs font-medium text-[#181716]">Explore New Collection</span>
      <ArrowRight className="w-4 h-4 text-[#A2574F] group-hover:translate-x-1 transition-transform" />
    </button>
  </div>
  </>
);

const DropdownColumn: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p className="px-2 pb-3 text-[10px] uppercase tracking-[0.2em] text-[#827E77] font-semibold">
      {title}
    </p>
    <div className="space-y-1">{children}</div>
  </div>
);

interface DropdownLinkProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

const DropdownLink: React.FC<DropdownLinkProps> = ({ label, onClick, icon }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className="w-full rounded-xl px-3 py-2.5 text-left text-xs text-[#63605A] hover:bg-[#FAF9F6] hover:text-[#181716] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] flex items-center gap-2"
  >
    {icon}
    {label}
  </button>
);

const CenterLogo: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <div className="absolute left-1/2 w-[124px] -translate-x-1/2 text-center sm:w-[170px] lg:left-0 lg:w-[170px] lg:translate-x-0">
    <button
      type="button"
      onClick={() => onNavigate('/')}
      className="group block text-center"
      aria-label="MODEZA Home"
    >
      <img
        src={modezaLogoUrl}
        alt="MODEZA Haute Prêt-à-Porter"
        className="mx-auto h-9 max-w-full w-auto object-contain transition-opacity group-hover:opacity-75 sm:h-12"
      />
    </button>
  </div>
);

const RightActions: React.FC<{
  onNavigate: (path: string) => void;
  onOpenSearch?: () => void;
  onOpenCart: () => void;
  cartCount: number;
  wishlistCount: number;
}> = ({ onNavigate, onOpenSearch, onOpenCart, cartCount, wishlistCount }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  return (
    <div className="relative flex shrink-0 items-center gap-1.5 border-l border-[#E8E5DF] pl-4 sm:gap-3 sm:pl-5 lg:gap-4 lg:pl-6">
      <button
        type="button"
        onClick={() => onNavigate('/about')}
        className="hidden lg:block text-[10px] uppercase tracking-[0.18em] font-semibold text-[#63605A] hover:text-[#181716] transition-colors py-1.5 px-2 rounded-full hover:bg-[#F3F1ED]"
      >
        About
      </button>

      <IconButton
        onClick={onOpenSearch}
        ariaLabel="Search catalog"
        title="Search collection"
      >
        <Search className="w-5 h-5 stroke-[1.5]" />
      </IconButton>

      <div className="relative hidden lg:block">
        <button
          type="button"
          onClick={() => setIsNotificationsOpen((current) => !current)}
          className="relative p-2.5 text-[#181716] hover:text-[#A2574F] transition-colors rounded-full hover:bg-[#F3F1ED]"
          aria-label={`Notifications, ${unreadCount} unread`}
          title="Notifications"
        >
          <Bell className="w-5 h-5 stroke-[1.5]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#A2574F] px-1 text-[9px] text-[#FAF9F6] font-semibold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {isNotificationsOpen && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              className="absolute right-0 top-full z-[300] mt-2 w-80 rounded-2xl border border-[#E8E5DF] bg-white p-3 shadow-2xl glass"
            >
              <div className="mb-2 flex items-center justify-between px-2 pb-2 border-b border-[#E8E5DF]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#827E77]">Notifications</span>
                  {unreadCount > 0 && <span className="rounded-full bg-[#FFF0E3] px-2 py-0.5 text-[10px] font-semibold text-[#8A5A2B]">{unreadCount} unread</span>}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllAsRead()}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A2574F] hover:text-[#181716] transition-colors"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-[#63605A]">No notifications yet.</div>
                ) : (
                  notifications.slice(0, 6).map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => {
                        if (notification.link) {
                          onNavigate(notification.link);
                        }
                        void markAsRead(notification.id);
                        setIsNotificationsOpen(false);
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        notification.isRead
                          ? 'border-[#E8E5DF] bg-[#FAF9F6]'
                          : 'border-[#E7D8B3] bg-[#FFFDF8]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[#827E77]">{notification.category}</div>
                          <div className="mt-1 text-sm font-medium text-[#181716]">{notification.title}</div>
                        </div>
                        {!notification.isRead && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#A2574F]" />}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#63605A]">{notification.message}</p>
                    </button>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onNavigate('/account/notifications');
                    setIsNotificationsOpen(false);
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E8E5DF] py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#A2574F] hover:bg-[#FAF9F6] transition-colors"
                >
                  <Bell className="h-3.5 w-3.5" />
                  View all notifications
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <IconButton
        className="hidden sm:block"
        onClick={() => onNavigate('/account')}
        ariaLabel="Customer account"
        title="Customer account"
      >
        <User className="w-5 h-5 stroke-[1.5]" />
      </IconButton>

      <IconButton
        className="hidden sm:block"
        onClick={() => onNavigate('/wishlist')}
        ariaLabel={`Wishlist with ${wishlistCount} saved items`}
        title="Wishlist"
      >
        <span className="relative block">
          <Heart className="w-5 h-5 stroke-[1.5]" />
          {wishlistCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#A2574F] px-1 text-[9px] text-[#FAF9F6] font-semibold">
              {wishlistCount}
            </span>
          )}
        </span>
      </IconButton>

      <button
        type="button"
        onClick={onOpenCart}
        className="relative flex items-center gap-2 p-2.5 text-[#181716] hover:text-[#A2574F] transition-colors rounded-full hover:bg-[#F3F1ED]"
        aria-label={`View shopping cart with ${cartCount} items`}
        title="Open Cart"
      >
        <ShoppingBag className="w-5 h-5 stroke-[1.5]" />
        <span className="hidden sm:inline text-[10px] uppercase tracking-[0.16em] font-semibold">
          Cart ({cartCount})
        </span>
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#A2574F] text-[#FAF9F6] text-[9px] rounded-full flex items-center justify-center font-semibold">
            {cartCount}
          </span>
        )}
      </button>
    </div>
  );
};

const IconButton: React.FC<{
  onClick?: () => void;
  ariaLabel: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}> = ({ onClick, ariaLabel, title, className = '', children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-2.5 text-[#181716] transition-colors rounded-full hover:bg-[#F3F1ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] focus-visible:ring-offset-2 hover:text-[#A2574F] ${className}`}
    aria-label={ariaLabel}
    title={title}
  >
    {children}
  </button>
);

const MobileMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  categories: NavigationItem[];
  productCategories: NavigationItem[];
  currentCategory?: string;
  cartCount: number;
  wishlistCount: number;
}> = ({ isOpen, onClose, onNavigate, categories, productCategories, currentCategory, cartCount, wishlistCount }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[400] lg:hidden"
    >
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-[#181716]/30 backdrop-blur-[2px]"
        aria-hidden="true"
      />

      {/* Drawer */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative flex h-full w-[min(88vw,380px)] flex-col bg-[#FAF9F6] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E8E5DF] px-6 py-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#827E77]">MODEZA</p>
            <h2 className="mt-1 font-serif text-2xl text-[#181716]">Menu</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#63605A] hover:bg-[#F4ECE9] hover:text-[#181716] transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-7">
          <MobileSection title="Browse">
            <MobileLink label="Home" onClick={() => onNavigate('/')} />
            <MobileLink label="About" onClick={() => onNavigate('/about')} />
            <MobileLink label="New Arrivals" onClick={() => onNavigate('/shop?collection=new-arrivals')} />
            <MobileLink label="Sale" onClick={() => onNavigate('/shop?sale=true')} />
          </MobileSection>

          <MobileSection title="Categories">
            {productCategories.map((cat) => (
              <MobileLink
                key={cat.slug}
                label={cat.label}
                onClick={() => onNavigate(cat.path)}
                isActive={currentCategory === cat.slug}
              />
            ))}
          </MobileSection>

          <MobileSection title="Shop">
            <MobileLink label="All Products" onClick={() => onNavigate('/shop')} />
            <MobileLink label="Best Sellers" onClick={() => onNavigate('/shop?collection=best-sellers')} />
            <MobileLink label="New Arrivals" onClick={() => onNavigate('/shop?collection=new-arrivals')} />
          </MobileSection>

          <MobileSection title="Shop by Category">
            {productCategories.map((cat) => (
              <MobileLink
                key={cat.slug}
                label={cat.label}
                onClick={() => onNavigate(cat.path)}
                isActive={currentCategory === cat.slug}
              />
            ))}
          </MobileSection>

          <MobileSection title="Shop by Occasion">
            <MobileLink label="Everyday" onClick={() => onNavigate('/shop?occasion=everyday')} />
            <MobileLink label="Evening" onClick={() => onNavigate('/shop?occasion=evening')} />
            <MobileLink label="Special Occasions" onClick={() => onNavigate('/shop?occasion=special-occasions')} />
          </MobileSection>

          <div className="mt-8 space-y-2 border-t border-[#E8E5DF] pt-6">
            <MobileLink label="My Account" onClick={() => onNavigate('/account')} />
            <MobileLink label={`Wishlist (${wishlistCount})`} onClick={() => onNavigate('/wishlist')} />
            <MobileLink label="Track Order" onClick={() => onNavigate('/track')} />
            <MobileLink label={`Cart (${cartCount})`} onClick={() => onNavigate('/cart')} />
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
};

const MobileSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8">
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#827E77]">
      {title}
    </p>
    <div className="space-y-1">{children}</div>
  </div>
);

const MobileLink: React.FC<{
  label: string;
  onClick: () => void;
  isActive?: boolean;
}> = ({ label, onClick, isActive = false }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-xl px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F] ${
      isActive
        ? 'bg-[#A2574F] text-[#FAF9F6] font-medium shadow-sm'
        : 'text-[#63605A] hover:bg-[#F4ECE9] hover:text-[#181716]'
    }`}
  >
    {label}
  </button>
);

export default Navbar;