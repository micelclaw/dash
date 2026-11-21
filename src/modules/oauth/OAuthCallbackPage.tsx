/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

import { useEffect, useState } from 'react';

/**
 * OAuth callback page — receives redirect from Google/Microsoft.
 * Passes code+state back to the opener window via postMessage.
 * The opener (AddIntegrationModal) handles the actual API call
 * since it has the authenticated session.
 */
export function Component() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if ((!code && !error) || !state) {setStatus('error');setErrorMsg('Falta el estado o resultado de la autorización.');return;}
    // El proveedor NO se adivina aquí.
    //
    // Esta página se carga en la dirección de retorno registrada en el
    // proveedor (`localhost:7100`), que es un ORIGEN DISTINTO del que sirve el
    // dash — y el almacenamiento local no se comparte entre orígenes. Leerlo de
    // ahí devolvía siempre vacío, y el valor por defecto era `'google'`: una
    // autorización de Microsoft se canjeaba contra Google, con un error
    // incomprensible («Malformed auth code»). Google parecía funcionar solo
    // porque el valor equivocado acertaba por casualidad.
    //
    // Quién es lo dice el `state`, que va cifrado y lo abre el servidor. Esto se
    // manda solo como pista y el servidor lo ignora.
    const controller=new AbortController();
    void (async()=>{
      try{
        if(!window.opener)throw Error('No hay ventana original. Reintenta desde Micelclaw.');
        const response=await fetch('/api/v1/sync/oauth/return-target',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({state}),signal:controller.signal});
        if(!response.ok)throw Error('No se pudo verificar el destino de esta autorización. Reintenta.');
        const value=await response.json() as {data:{return_origin:string}};const target=new URL(value.data.return_origin);
        if(!['http:','https:'].includes(target.protocol)||target.origin!==value.data.return_origin)throw Error('Destino de retorno no válido');
        window.opener.postMessage({type:'oauth_callback',code,state,...(error?{error:error==='access_denied'?'access_denied':'provider_error'}:{})},target.origin);
        setStatus(error?'error':'success');if(error)setErrorMsg(error==='access_denied'?'Autorización denegada.':'El proveedor no completó la autorización.');
      }catch(error){if(!controller.signal.aborted){setStatus('error');setErrorMsg(error instanceof Error?error.message:'No se pudo devolver la autorización');}}
    })();
    return ()=>controller.abort();
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--bg)', color: 'var(--text)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        {status === 'loading' && (
          <div style={{ fontSize: '1.25rem' }}>Connecting...</div>
        )}
        {status === 'success' && (
          <>
            <div style={{ fontSize: '1.25rem', marginBottom: 8, color: 'var(--success)' }}>
              Autorización recibida
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              La ventana original debe confirmar la conexión y la selección de colecciones.
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '1.25rem', marginBottom: 8, color: 'var(--error)' }}>
              Authorization Failed
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.875rem' }}>
              {errorMsg}
            </div>
            <button
              onClick={() => window.close()}
              style={{
                marginTop: 16, padding: '6px 16px',
                background: 'var(--surface)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
