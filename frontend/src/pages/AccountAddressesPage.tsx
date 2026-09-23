import React, { useCallback, useEffect, useState } from 'react';
import { Check, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { AccountPageHeader } from '../components/account/AccountPageHeader';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../router/RouterContext';
import {
  EMPTY_ADDRESS,
  SavedAddress,
  getSavedAddresses,
  removeAddress,
  setDefaultAddress,
  upsertAddress,
} from '../utils/addressBook';
import { KENYA_COUNTIES, KENYA_COUNTY_SUBCOUNTIES, KENYA_SUBCOUNTY_CITIES } from '../data/kenyaLocations';

export const AccountAddressesPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY_ADDRESS });
  const [deleteTarget, setDeleteTarget] = useState<SavedAddress | null>(null);

  const userId = user?.id ?? '';

  useEffect(() => {
    if (!userId) {
      setAddresses([]);
      return;
    }
    setAddresses(getSavedAddresses(userId, { seed: true }));
  }, [userId]);

  const openAdd = useCallback(() => {
    setDraft({ ...EMPTY_ADDRESS });
    setEditingId(null);
    setIsFormOpen(true);
  }, []);

  const openEdit = useCallback((address: SavedAddress) => {
    setDraft({ ...address });
    setEditingId(address.id);
    setIsFormOpen(true);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setAddresses(
      upsertAddress(userId, {
        ...draft,
        id: editingId ?? undefined,
      })
    );
    setIsFormOpen(false);
  };

  const handleRemove = () => {
    if (!userId || !deleteTarget) return;
    setAddresses(removeAddress(userId, deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleSetDefault = (id: string) => {
    if (!userId) return;
    setAddresses(setDefaultAddress(userId, id));
  };

  const handleDraftChange = (name: keyof typeof EMPTY_ADDRESS, value: string) => {
    setDraft((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'county') {
        next.subcounty = '';
        next.city = '';
      }
      if (name === 'subcounty') {
        next.city = '';
      }
      return next;
    });
  };

  const subcountiesForCounty = KENYA_COUNTY_SUBCOUNTIES[draft.county] || [];
  const citiesForSubcounty = KENYA_SUBCOUNTY_CITIES[draft.subcounty] || (draft.subcounty ? [draft.subcounty] : []);

  if (!user) {
    return (
      <section className="w-full space-y-6">
        <AccountPageHeader
          eyebrow="Account"
          title="Addresses"
          description="Delivery details saved for a seamless checkout."
        />
        <div className="rounded-2xl border border-[#E8E5DF] bg-white p-6 text-center text-sm text-[#63605A] sm:p-8">
          Sign in to manage your saved delivery addresses.
        </div>
      </section>
    );
  }

  return (
    <section className="w-full space-y-6">
      <AccountPageHeader
        eyebrow="Account"
        title="Addresses"
        description="Delivery details saved for a seamless checkout."
      />

      <div className="space-y-4">
        {addresses.length === 0 ? (
          <div className="rounded-2xl border border-[#E8E5DF] bg-white p-8 text-center">
            <MapPin className="mx-auto h-6 w-6 text-[#A2574F]" aria-hidden="true" />
            <p className="mt-3 font-serif text-xl text-[#181716]">No saved addresses yet</p>
            <p className="mt-1 text-sm text-[#63605A]">
              Add a delivery address so future checkout is a single tap.
            </p>
            <Button type="button" variant="primary" size="md" className="mt-5 gap-2" onClick={openAdd}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add a New Address
            </Button>
          </div>
        ) : (
          addresses.map((address) => (
            <article
              key={address.id}
              className="rounded-2xl border border-[#E8E5DF] bg-white p-6 shadow-xs sm:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FAF9F6] ring-1 ring-[#E8E5DF]">
                    <MapPin className="h-5 w-5 text-[#A2574F]" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-serif text-lg tracking-tight text-[#181716]">
                        {address.label || 'Saved Address'}
                      </h3>
                      {address.isDefault ? (
                        <span className="rounded-full bg-[#A2574F] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FAF9F6]">
                          Default
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(address.id)}
                          className="flex items-center gap-1 rounded-full border border-[#E8E5DF] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A2574F] hover:bg-[#FAF9F6] transition-colors"
                        >
                          <Star className="h-3 w-3" aria-hidden="true" />
                          Set Default
                        </button>
                      )}
                    </div>
                    <div className="mt-2.5 text-sm leading-relaxed text-[#181716]">
                      <p className="font-medium">
                        {address.firstName} {address.lastName}
                      </p>
                      <p className="text-[#63605A]">{address.addressLine1}</p>
                      {address.addressLine2 && <p className="text-[#63605A]">{address.addressLine2}</p>}
                      <p className="text-[#63605A]">{address.city}, {address.county}</p>
                      <p className="text-[#63605A]">{address.country} {address.postalCode}</p>
                      <p className="mt-1.5 text-xs text-[#827E77]">Phone: {address.phone}</p>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => openEdit(address)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-[#9E332B]"
                    onClick={() => setDeleteTarget(address)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}

        {addresses.length > 0 && (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center gap-2 py-3.5 text-xs uppercase tracking-wider sm:w-auto"
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a New Address
          </Button>
        )}
      </div>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingId ? 'Edit Address' : 'Add a New Address'}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Address Label"
              id="address-label"
              value={draft.label}
              onChange={(e) => handleDraftChange('label', e.target.value)}
              placeholder="Home"
              helperText="A short name for this address."
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                id="address-first-name"
                required
                value={draft.firstName}
                onChange={(e) => handleDraftChange('firstName', e.target.value)}
                placeholder="Jane"
              />
              <Input
                label="Last Name"
                id="address-last-name"
                required
                value={draft.lastName}
                onChange={(e) => handleDraftChange('lastName', e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          <Input
            label="Street Address"
            id="address-line-1"
            required
            value={draft.addressLine1}
            onChange={(e) => handleDraftChange('addressLine1', e.target.value)}
            placeholder="123 Moi Avenue"
          />
          <Input
            label="Apartment, Suite, Unit (Optional)"
            id="address-line-2"
            value={draft.addressLine2}
            onChange={(e) => handleDraftChange('addressLine2', e.target.value)}
            placeholder="Apt 4B"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              id="address-country"
              value={draft.country}
              disabled
              className="w-full bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl px-3.5 py-2.5 text-sm text-[#63605A]"
              aria-label="Country"
            >
              <option value="Kenya">Kenya</option>
            </select>
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#63605A] mb-1.5">
                County <span className="text-[#9E332B]">*</span>
              </span>
              <select
                required
                value={draft.county}
                onChange={(e) => handleDraftChange('county', e.target.value)}
                className="w-full appearance-none bg-[#FFFFFF] border border-[#E8E5DF] rounded-xl px-3.5 py-2.5 text-sm text-[#181716] focus:outline-none focus:ring-1 focus:border-[#A2574F] focus:ring-[#A2574F]"
                aria-label="County"
              >
                <option value="" disabled>
                  Select County
                </option>
                {KENYA_COUNTIES.map((county) => (
                  <option key={county} value={county}>
                    {county}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#63605A] mb-1.5">
                Subcounty <span className="text-[#9E332B]">*</span>
              </span>
              <select
                required
                value={draft.subcounty}
                onChange={(e) => handleDraftChange('subcounty', e.target.value)}
                disabled={!draft.county || subcountiesForCounty.length === 0}
                className="w-full appearance-none bg-[#FFFFFF] border border-[#E8E5DF] rounded-xl px-3.5 py-2.5 text-sm text-[#181716] focus:outline-none focus:ring-1 focus:border-[#A2574F] focus:ring-[#A2574F] disabled:bg-[#FAF9F6] disabled:text-[#A29E96]"
                aria-label="Subcounty"
              >
                <option value="" disabled>
                  Select Subcounty
                </option>
                {subcountiesForCounty.map((subcounty) => (
                  <option key={subcounty} value={subcounty}>
                    {subcounty}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wider text-[#63605A] mb-1.5">
                City <span className="text-[#9E332B]">*</span>
              </span>
              <select
                required
                value={draft.city}
                onChange={(e) => handleDraftChange('city', e.target.value)}
                disabled={!draft.subcounty || citiesForSubcounty.length === 0}
                className="w-full appearance-none bg-[#FFFFFF] border border-[#E8E5DF] rounded-xl px-3.5 py-2.5 text-sm text-[#181716] focus:outline-none focus:ring-1 focus:border-[#A2574F] focus:ring-[#A2574F] disabled:bg-[#FAF9F6] disabled:text-[#A29E96]"
                aria-label="City"
              >
                <option value="" disabled>
                  Select City
                </option>
                {citiesForSubcounty.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Postal Code"
              id="address-postal"
              required
              value={draft.postalCode}
              onChange={(e) => handleDraftChange('postalCode', e.target.value)}
              placeholder="00100"
            />
            <Input
              label="Phone Number"
              id="address-phone"
              type="tel"
              required
              value={draft.phone}
              onChange={(e) => handleDraftChange('phone', e.target.value)}
              placeholder="+254 7XX XXX XXX"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-sm px-4 py-2 rounded-full border border-[#E8E5DF] text-[#181716] bg-transparent hover:bg-[#F3F1ED] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A2574F]"
            >
              Cancel
            </button>
            <Button type="submit" variant="primary" size="sm" className="gap-1.5">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {editingId ? 'Save Changes' : 'Save Address'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleRemove}
        title="Remove address?"
        message={
          deleteTarget
            ? `Remove "${deleteTarget.label || 'Saved Address'}" (${deleteTarget.addressLine1}) from your book?`
            : ''
        }
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />

      <p className="text-xs text-[#827E77]">
        Addresses are stored privately on this device for the signed-in profile and are used to prefill checkout.
      </p>
    </section>
  );
};