import React from 'react';
import { ArrowRight, Feather, ShieldCheck, Truck } from 'lucide-react';
import { useRouter } from '../router/RouterContext';
import { Badge, Button, Card, CardContent, Separator } from '../components/modeza';

export const AboutPage: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="overflow-hidden bg-[#FAF9F6] pb-20">
      <section className="relative border-b border-[#E8E5DF] bg-[#181716] text-[#FAF9F6]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#A2574F]/20 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-[#E68057]/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E68057]/60 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="About MODEZA sections"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 py-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50"
          >
            <span className="text-white/75">The MODEZA story</span>
            <Separator orientation="vertical" className="h-3 w-px bg-white/20" />
            <a
              href="#point-of-view"
              className="rounded-sm transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E68057]"
            >
              Our point of view
            </a>
            <Separator orientation="vertical" className="h-3 w-px bg-white/20" />
            <a
              href="#values"
              className="rounded-sm transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E68057]"
            >
              Natural materials
            </a>
          </nav>

          <div className="grid gap-10 py-16 sm:py-24 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:gap-16 lg:py-28">
            <div className="max-w-4xl">
              <Badge variant="new" size="lg" className="gap-2">
                <Feather className="h-3 w-3" aria-hidden="true" />
                The MODEZA story
              </Badge>
              <h1 className="mt-6 max-w-4xl font-serif text-5xl font-normal leading-[1.06] tracking-tight text-balance sm:text-6xl lg:text-7xl">
                Considered clothing for a life well lived.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-8 text-[#D8D0C5] sm:text-lg">
                MODEZA is a considered wardrobe of fluid tailoring, natural fibers, and enduring silhouettes. We work with small studios to make fewer pieces, better.
              </p>
            </div>
            <div aria-hidden="true" className="relative hidden h-64 lg:block">
              <div className="absolute right-8 top-0 h-full w-px bg-gradient-to-b from-[#E68057]/70 via-white/20 to-transparent" />
              <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full border border-white/10" />
              <div className="absolute bottom-10 right-10 h-20 w-20 rounded-full border border-white/10" />
              <span className="absolute bottom-[-0.25rem] right-[-0.5rem] font-serif text-[16rem] leading-none text-white/[0.04]">
                M
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="point-of-view" aria-labelledby="point-of-view-heading" className="scroll-mt-8">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:px-8 lg:py-28">
          <Card className="group overflow-hidden border-[#E8E5DF] bg-[#F4ECE9] p-0 shadow-sm hover:shadow-xl">
            <div className="relative aspect-[4/5] overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1200&auto=format&fit=crop"
                alt="Natural textile arranged in an modeza"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#181716]/35 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 sm:bottom-7 sm:left-7">
                <Badge variant="outline" className="border-white/30 bg-[#181716]/20 text-white backdrop-blur-sm">
                  Natural materials
                </Badge>
              </div>
            </div>
          </Card>

          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="font-serif text-4xl leading-none text-[#C6A77A]">
                01
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#A2574F]">Our point of view</p>
            </div>
            <Separator className="my-7 bg-[#E8E5DF]" />
            <h2 id="point-of-view-heading" className="max-w-lg font-serif text-3xl font-normal leading-tight tracking-tight text-[#181716] sm:text-4xl">
              Quiet design, deliberate detail.
            </h2>
            <div className="mt-6 space-y-4 text-sm leading-7 text-[#63605A] sm:text-[15px] sm:leading-8">
              <p>
                Every MODEZA piece begins with the material. We choose traceable silk, responsible wool, and fine cashmere for their handfeel, longevity, and ability to move with the wearer.
              </p>
              <p>
                Our collections are made in small batches and designed to live beyond a single season. The result is a wardrobe that feels personal, useful, and quietly distinctive.
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={() => navigate('/shop')} className="mt-8 gap-2">
              Explore the collection
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      <section id="values" aria-labelledby="values-heading" className="scroll-mt-8 border-y border-[#E8E5DF] bg-[#FFFFFF]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] lg:items-end lg:gap-16">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#A2574F]">Our point of view</p>
              <h2 id="values-heading" className="mt-4 max-w-sm font-serif text-3xl font-normal leading-tight tracking-tight text-[#181716] sm:text-4xl">
                The MODEZA way
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Value icon={<Feather className="h-5 w-5" />} title="Natural materials" text="Fibers selected for comfort, character, and lasting wear." />
              <Value icon={<ShieldCheck className="h-5 w-5" />} title="Small-batch craft" text="Thoughtful production with trusted artisan studios." />
              <Value icon={<Truck className="h-5 w-5" />} title="Considered service" text="A calm, personal shopping experience from order to delivery." />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const Value: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <Card className="h-full border-[#E8E5DF] bg-white p-0 shadow-sm">
    <CardContent className="flex h-full flex-col p-5 sm:p-6">
      <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F4ECE9] text-[#A2574F]">
        {icon}
      </span>
      <h3 className="mt-6 font-serif text-xl font-normal leading-tight text-[#181716]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#63605A]">{text}</p>
    </CardContent>
  </Card>
);
