"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Fingerprint, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { enrollPasskey } from "@/lib/webauthn-client";

export function BiometricEnrollModal({
  isOpen,
  onClose,
  currentUserId,
  currentUserEmail,
  onError,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string | null;
  currentUserEmail: string | null;
  onError: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function handleClose() {
    setDone(false);
    onClose();
  }

  async function handleSetup() {
    if (!currentUserId || !currentUserEmail) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");
      await enrollPasskey(currentUserId, currentUserEmail, session.access_token);
      setDone(true);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Erro ao vincular digital.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Vincular Digital / Face ID">
      <div className="p-8 space-y-6">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-zinc-800">Digital vinculada!</p>
              <p className="text-sm text-zinc-500 mt-1">
                Na próxima vez que acessar, toque no botão de digital na tela de login.
              </p>
            </div>
            <Button
              onClick={handleClose}
              className="w-full h-14 font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl"
            >
              Concluído
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
                <Fingerprint size={40} className="text-indigo-500" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-bold text-zinc-800">Vincular digital / Face ID</p>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Ao clicar no botão abaixo, o navegador pedirá confirmação com sua biometria
                  (Touch ID, Face ID ou Windows Hello). Nenhuma senha é necessária.
                </p>
              </div>
            </div>

            <div className="bg-indigo-50 rounded-2xl p-4 text-sm text-indigo-700 space-y-1">
              <p className="font-bold text-xs uppercase tracking-wider text-indigo-500">Como funciona</p>
              <p>A chave biométrica fica salva <strong>neste dispositivo</strong>. Você precisará repetir em cada aparelho que quiser usar biometria.</p>
            </div>

            <Button
              onClick={handleSetup}
              loading={saving}
              className="w-full h-14 font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl"
            >
              <Fingerprint size={20} className="mr-2" />
              {saving ? "Aguardando biometria..." : "Vincular agora"}
            </Button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
