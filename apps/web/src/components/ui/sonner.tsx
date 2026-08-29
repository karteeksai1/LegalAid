import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#151a17] group-[.toaster]:text-[#f1eee6] group-[.toaster]:border group-[.toaster]:border-white/20 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-none",
          title: "group-[.toast]:text-[#f1eee6] group-[.toast]:font-semibold group-[.toast]:text-sm",
          description: "group-[.toast]:text-[#a9afa7] group-[.toast]:text-xs group-[.toast]:mt-1 group-[.toast]:leading-relaxed",
          actionButton:
            "group-[.toast]:bg-[#d7ff52] group-[.toast]:text-[#101412] group-[.toast]:rounded-none group-[.toast]:font-mono group-[.toast]:text-xs group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:bg-white/10 group-[.toast]:text-[#f1eee6] group-[.toast]:rounded-none group-[.toast]:font-mono group-[.toast]:text-xs",
        },
      }}
      style={
        {
          "--normal-bg": "#151a17",
          "--normal-text": "#f1eee6",
          "--normal-border": "rgba(255, 255, 255, 0.2)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
