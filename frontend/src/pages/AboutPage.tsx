import React from 'react';
import { ArrowRight, Feather, ShieldCheck, Truck } from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { Button } from '../components/ui/Button';

export const AboutPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="pb-20">
      <section className="border-b border-[#E8E5DF] bg-[#181716] text-[#FAF9F6]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#C6A77A]">The MODEZA story</p>
          <h1 className="mt-5 max-w-3xl font-serif text-4xl font-normal leading-tight sm:text-6xl">
            Considered clothing for a life well lived.
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-[#D8D0C5] sm:text-base">
            MODEZA is a considered wardrobe of fluid tailoring, natural fibers, and enduring silhouettes. We work with small studios to make fewer pieces, better.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
        <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-[#EFECE6]">
          <img
            src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1200&auto=format&fit=crop"
            alt="Natural textile arranged in an modeza"
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8A745C]">Our point of view</p>
          <h2 className="mt-4 font-serif text-3xl font-normal text-[#181716] sm:text-4xl">Quiet design, deliberate detail.</h2>
          <p className="mt-6 text-sm leading-7 text-[#63605A]">
            Every MODEZA piece begins with the material. We choose traceable silk, responsible wool, and fine cashmere for their handfeel, longevity, and ability to move with the wearer.
          </p>
          <p className="mt-4 text-sm leading-7 text-[#63605A]">
            Our collections are made in small batches and designed to live beyond a single season. The result is a wardrobe that feels personal, useful, and quietly distinctive.
          </p>
          <Button variant="primary" size="md" onClick={() => navigate('/shop')} className="mt-8 gap-2">
            Explore the collection
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <section className="border-y border-[#E8E5DF] bg-[#FFFFFF]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:px-8">
          <Value icon={<Feather className="h-5 w-5" />} title="Natural materials" text="Fibers selected for comfort, character, and lasting wear." />
          <Value icon={<ShieldCheck className="h-5 w-5" />} title="Small-batch craft" text="Thoughtful production with trusted artisan studios." />
          <Value icon={<Truck className="h-5 w-5" />} title="Considered service" text="A calm, personal shopping experience from order to delivery." />
        </div>
      </section>
    </div>
  );
};

const Value: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <div className="border-l border-[#E8E5DF] pl-5">
    <div className="text-[#8A745C]">{icon}</div>
    <h3 className="mt-4 font-serif text-xl text-[#181716]">{title}</h3>
    <p className="mt-2 text-xs leading-6 text-[#63605A]">{text}</p>
  </div>
);
