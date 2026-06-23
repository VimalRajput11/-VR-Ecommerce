import { Mail, MessageCircle, Clock } from "lucide-react";

const InstagramIcon = ({ size = 24, strokeWidth = 2, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);

export default function ContactPage() {
  return (
    <div className="pt-32 pb-24 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        
        <div className="text-center mb-20">
          <h1 className="font-serif text-4xl md:text-5xl text-brand-white mb-4">
            Contact <span className="gold-gradient-text italic">Us</span>
          </h1>
          <p className="text-brand-white/70 max-w-2xl mx-auto font-light">
            We are here to assist you. Reach out to us for custom orders, styling advice, or any inquiries regarding your VR Nails experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-24">
          
          {/* Left Side: Contact Information */}
          <div className="space-y-12">
            <div>
              <h3 className="font-serif text-2xl text-brand-white mb-6">Get in Touch</h3>
              <p className="text-brand-white/60 font-light leading-relaxed mb-8">
                Whether you have a question about a specific collection or need help with sizing, our dedicated concierges are at your service.
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 border border-brand-white/10 rounded-sm flex items-center justify-center text-brand-gold flex-shrink-0">
                  <Mail size={20} strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="text-brand-white font-medium mb-1">Email Concierge</h4>
                  <p className="text-brand-white/50 text-sm font-light">hello@vrnails.com</p>
                  <p className="text-brand-white/50 text-sm font-light">Response within 24 hours</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 border border-brand-white/10 rounded-sm flex items-center justify-center text-brand-gold flex-shrink-0">
                  <MessageCircle size={20} strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="text-brand-white font-medium mb-1">WhatsApp Client Care</h4>
                  <p className="text-brand-white/50 text-sm font-light">+91 98765 43210</p>
                  <p className="text-brand-white/50 text-sm font-light">Instant messaging support</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 border border-brand-white/10 rounded-sm flex items-center justify-center text-brand-gold flex-shrink-0">
                  <Clock size={20} strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="text-brand-white font-medium mb-1">Operating Hours</h4>
                  <p className="text-brand-white/50 text-sm font-light">Monday - Saturday</p>
                  <p className="text-brand-white/50 text-sm font-light">10:00 AM - 7:00 PM IST</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 border border-brand-white/10 rounded-sm flex items-center justify-center text-brand-gold flex-shrink-0">
                  <InstagramIcon size={20} strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="text-brand-white font-medium mb-1">Instagram</h4>
                  <p className="text-brand-white/50 text-sm font-light">@vr_nails</p>
                  <p className="text-brand-white/50 text-sm font-light">Tag us in your looks</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Contact Form */}
          <div className="bg-[#0A0A0A] p-8 md:p-10 border border-brand-white/5 rounded-sm shadow-2xl">
            <h3 className="font-serif text-2xl text-brand-white mb-8">Send a Message</h3>
            <form className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-xs uppercase tracking-widest text-brand-white/50 mb-2">First Name</label>
                  <input 
                    type="text" 
                    id="firstName"
                    className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:outline-none focus:border-brand-gold transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-xs uppercase tracking-widest text-brand-white/50 mb-2">Last Name</label>
                  <input 
                    type="text" 
                    id="lastName"
                    className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:outline-none focus:border-brand-gold transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-xs uppercase tracking-widest text-brand-white/50 mb-2">Email Address *</label>
                <input 
                  type="email" 
                  id="email"
                  required
                  className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-xs uppercase tracking-widest text-brand-white/50 mb-2">Subject</label>
                <select 
                  id="subject"
                  className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:outline-none focus:border-brand-gold transition-colors appearance-none"
                >
                  <option value="general" className="bg-brand-black">General Inquiry</option>
                  <option value="order" className="bg-brand-black">Order Status</option>
                  <option value="custom" className="bg-brand-black">Custom Press-On Design</option>
                  <option value="wholesale" className="bg-brand-black">Wholesale & PR</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-xs uppercase tracking-widest text-brand-white/50 mb-2">Message *</label>
                <textarea 
                  id="message"
                  rows={4}
                  required
                  className="w-full bg-transparent border-b border-brand-white/20 pb-2 text-brand-white focus:outline-none focus:border-brand-gold transition-colors resize-none"
                ></textarea>
              </div>

              <button 
                type="button" 
                className="w-full py-4 mt-4 bg-brand-white/5 border border-brand-white/10 hover:bg-brand-gold hover:text-brand-black hover:border-brand-gold text-brand-white uppercase tracking-widest text-sm font-medium transition-all duration-300"
              >
                Send Message
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
