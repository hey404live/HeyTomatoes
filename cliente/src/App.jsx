import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Check, ChevronDown, Clapperboard, Film, Heart, LayoutGrid, Menu, MessageSquare, Plus, Search, Shield, Sparkles, Star, TrendingUp, X } from 'lucide-react'
import { listMovies, listReviews, createReview, createMovie, updateMovie, deleteMovie, loginAdmin, clearAdminToken } from './api'

const genres = ['Todas','Ciencia ficción','Drama','Thriller','Animación','Fantasía']
const img = movie => /^(https?:|data:)/.test(movie.image) ? movie.image : `/images/${movie.image}`
function Stars({ value, small=false }) { return <span className={`stars ${small?'small':''}`} aria-label={`${value} de 5 estrellas`}>{[1,2,3,4,5].map(n=><Star key={n} size={small?12:15} fill={n<=Math.round(value)?'currentColor':'none'} />)}</span> }
function Brand(){return <span className="brand"><span className="brand-icon"><Clapperboard size={21}/></span>hey<span className="brand-red">tomatoes</span><span className="brand-dot">.</span></span>}
function Modal({children,close,busy=false}) {
 const ref=useRef(null)
 useEffect(()=>{const previous=document.activeElement;ref.current.showModal();document.body.style.overflow='hidden';return()=>{document.body.style.overflow='';previous?.focus()}},[])
 return <dialog ref={ref} className="modal" aria-label="Detalle y formulario" onCancel={event=>{event.preventDefault();if(!busy)close()}} onClick={e=>{if(!busy&&e.target===ref.current)close()}}><button className="icon-button close-modal" aria-label="Cerrar" disabled={busy} onClick={close}><X size={21}/></button>{children}</dialog>
}
export default function App(){
 const [movies,setMovies]=useState([]),[view,setView]=useState('explore'),[genre,setGenre]=useState('Todas'),[query,setQuery]=useState(''),[sort,setSort]=useState('popular'),[saved,setSaved]=useState([]),[selected,setSelected]=useState(null),[newMovie,setNewMovie]=useState(false),[toast,setToast]=useState(''),[mobileMenu,setMobileMenu]=useState(false)
 const [adminAuthenticated,setAdminAuthenticated]=useState(false)
 const [editing,setEditing]=useState(null),[deleting,setDeleting]=useState(null)
 const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[reload,setReload]=useState(0)
 useEffect(()=>{
   const controller=new AbortController()
   setLoading(true);setLoadError('')
   listMovies(controller.signal,view==='admin'&&adminAuthenticated).then(data=>{if(!controller.signal.aborted)setMovies(data)}).catch(error=>{
     if(!controller.signal.aborted)setLoadError(error instanceof TypeError?'No pudimos conectar con el servidor. Comprueba que la API esté encendida.':error.message)
   }).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
   return()=>controller.abort()
 },[reload,view,adminAuthenticated])
 const logoutAdmin=()=>{clearAdminToken();setAdminAuthenticated(false);setEditing(null);setDeleting(null);setNewMovie(false);setSelected(null)}
 useEffect(()=>{
   const expired=()=>{clearAdminToken();setAdminAuthenticated(false);setEditing(null);setDeleting(null);setNewMovie(false);setSelected(null);setToast('El acceso de administración expiró. Ingresa el token de nuevo.')}
   window.addEventListener('admin-session-expired',expired)
   return()=>window.removeEventListener('admin-session-expired',expired)
 },[])
 const catalogGenres=['Todas',...new Set(movies.map(movie=>movie.genre))]
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timer)},[toast])
 const navigate=(next)=>{setView(next);setQuery('');setGenre('Todas');setMobileMenu(false);window.scrollTo({top:0,behavior:'smooth'})}
 const toggleSave=id=>setSaved(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
 const score=movie=>movie.score===null?'—':movie.score.toLocaleString('es-CO',{maximumFractionDigits:2})
 const filtered=movies.filter(m=>(genre==='Todas'||m.genre===genre)&&m.title.toLowerCase().includes(query.toLowerCase())&&(view!=='saved'||saved.includes(m.id))).sort((a,b)=>sort==='rating'?(b.score??-1)-(a.score??-1):sort==='recent'?b.year-a.year:b.votes-a.votes)
 return <div className="app-shell">
 <header className="header"><div className="header-inner"><a href="#" onClick={e=>{e.preventDefault();navigate('explore')}} aria-label="HeyTomatoes, inicio"><Brand/></a><nav className={mobileMenu?'main-nav mobile-open':'main-nav'} aria-label="Navegación principal"><button className={view==='explore'?'active':''} onClick={()=>navigate('explore')}>Descubrir</button><button className={view==='saved'?'active':''} onClick={()=>navigate('saved')}>Mi lista {saved.length>0&&<span className="count">{saved.length}</span>}</button></nav><div className="header-actions"><button className={`admin-link ${view==='admin'?'selected':''}`} onClick={()=>navigate('admin')}><Shield size={15}/><span>Administración</span></button><div className="header-divider"/><span className="profile" title="Perfil de demostración">T</span><button className="icon-button mobile-toggle" aria-label="Abrir navegación" onClick={()=>setMobileMenu(!mobileMenu)}><Menu size={22}/></button></div></div></header>
 {(view==='explore'||view==='saved')&&<main className="page-width catalog-section" id="catalog"><div className="section-heading"><div><div className="eyebrow red-text">{view==='saved'?'TU PROPIA SELECCIÓN':'TU PRÓXIMA GRAN HISTORIA'}</div><h2>{view==='saved'?'Mi lista de películas':'Vale la pena darle play'}<span className="red-text">.</span></h2><p>{view==='saved'?'Las historias que quieres descubrir, en un solo lugar.':'Encuentra tu próxima favorita. Y cuéntanos por qué lo es.'}</p></div><label className="search-box"><Search size={18}/><input aria-label="Buscar películas" placeholder="Buscar una película…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Borrar búsqueda" onClick={()=>setQuery('')}><X size={15}/></button>}</label></div><div className="catalog-toolbar"><div className="filters" aria-label="Filtrar por género">{catalogGenres.map(g=><button key={g} className={g===genre?'active':''} onClick={()=>setGenre(g)}>{g==='Todas'&&<LayoutGrid size={13}/>} {g}</button>)}</div><label className="sort-control"><TrendingUp size={15}/><select aria-label="Ordenar películas" value={sort} onChange={e=>setSort(e.target.value)}><option value="popular">Más populares</option><option value="rating">Mejor calificadas</option><option value="recent">Más recientes</option></select><ChevronDown size={13}/></label></div>{loading&&<div className="empty-state" role="status">Cargando películas…</div>}{loadError&&<div className="empty-state" role="alert"><h3>No se pudo cargar el catálogo</h3><p>{loadError}</p><button className="button secondary" onClick={()=>setReload(value=>value+1)}>Reintentar</button></div>}{!loading&&movies.some(movie=>movie.ratingError)&&<div className="demo-notice" role="status"><span>No se pudieron cargar algunas calificaciones.</span><button className="text-button" onClick={()=>setReload(value=>value+1)}>Reintentar</button></div>}<div className="movie-grid">{filtered.map(movie=><article className="movie-card" key={movie.id}><div className="poster-wrap"><button className="poster-button" onClick={()=>setSelected(movie)} aria-label={`Ver ${movie.title}`}><img src={img(movie)} alt={`Póster de ${movie.title}`} loading="lazy"/><span className="poster-overlay"><span>Descubrir película <ArrowUpRight size={18}/></span></span></button>{movie.tag&&<span className="movie-tag">{movie.tag==='LA FAVORITA'&&<Sparkles size={10}/>} {movie.tag}</span>}<button className={`save-button ${saved.includes(movie.id)?'saved':''}`} aria-label={`${saved.includes(movie.id)?'Quitar':'Guardar'} ${movie.title}`} aria-pressed={saved.includes(movie.id)} onClick={()=>toggleSave(movie.id)}><Bookmark size={17} fill={saved.includes(movie.id)?'currentColor':'none'}/></button><span className="poster-rating"><Star size={13} fill="currentColor"/>{score(movie)}</span></div><button className="movie-title" onClick={()=>setSelected(movie)}>{movie.title}</button><div className="movie-meta">{movie.year}<span>·</span>{movie.genre}</div><div className="movie-rating"><Stars value={movie.score??0} small/><span>{movie.ratingError?'Calificación no disponible':movie.score===null?'Sin calificaciones':`${movie.votes.toLocaleString('es-CO')} ${movie.votes===1?'calificación':'calificaciones'}`}</span></div></article>)}</div>{!loading&&!loadError&&!filtered.length&&<div className="empty-state"><Bookmark size={30}/><h3>{view==='saved'?'Tu próxima historia te espera':movies.length?'No encontramos esa película':'Todavía no hay películas'}</h3><p>{view==='saved'?'Guarda películas con el icono de marcador para verlas aquí.':movies.length?'Prueba otro título o cambia el género.':'Las películas que publiques en el servidor aparecerán aquí.'}</p><button className="button secondary" onClick={()=>{if(view==='saved')navigate('explore');else{setQuery('');setGenre('Todas')}}}>{view==='saved'?'Explorar películas':'Limpiar filtros'}</button></div>}<div className="catalog-foot"><span>{filtered.length} películas · Miles de historias por descubrir</span><span>Hecho para amantes del cine <Heart size={12}/></span></div></main>}
 {view==='admin'&&!adminAuthenticated&&<AdminLogin onLogin={()=>setAdminAuthenticated(true)}/>}
 {view==='admin'&&adminAuthenticated&&<main className="page-width admin-page"><div className="section-heading"><div><div className="eyebrow red-text">DETRÁS DE CÁMARAS</div><h2>Panel de administración<span className="red-text">.</span></h2><p>Gestiona las historias que tu comunidad va a descubrir.</p></div><div className="admin-row-actions"><button className="button secondary" onClick={logoutAdmin}>Cerrar sesión</button><button className="button primary" onClick={()=>setNewMovie(true)}><Plus size={17}/> Publicar película</button></div></div><div className="demo-notice"><Shield size={18}/><span>Los cambios se guardan en el servidor. Al borrar una película también se eliminan sus calificaciones y comentarios.</span></div>{loading&&<p className="muted" role="status">Cargando catálogo…</p>}{loadError&&<div role="alert"><p className="form-error">{loadError}</p><button className="text-button" onClick={()=>setReload(value=>value+1)}>Reintentar</button></div>}<div className="admin-stats">{[[Film,movies.length,'Películas publicadas'],[MessageSquare,movies.some(m=>m.ratingError)?'—':movies.reduce((sum,m)=>sum+m.votes,0),'Calificaciones'],[Star,'0–5','Escala de calificación']].map(([Icon,n,label])=><div key={label}><Icon size={22}/><strong>{n}</strong><span>{label}</span></div>)}</div><div className="admin-table"><div className="admin-table-head"><h3>Catálogo de películas</h3><span>{movies.length} publicaciones</span></div>{!loading&&!loadError&&!movies.length&&<div className="empty-state"><h3>Todavía no hay películas</h3><p>Publica la primera película para empezar.</p></div>}{movies.map(m=><div className="admin-row" key={m.id}><img src={img(m)} alt=""/><div><h4>{m.title}</h4><p>{m.year} · {m.genre}</p></div><span className="published"><span/> Publicada</span><span className="admin-score"><Star size={14} fill="currentColor"/> {score(m)}</span><div className="admin-row-actions"><button className="text-button" onClick={()=>setSelected(m)} aria-label={`Ver detalle de ${m.title}`}>Ver detalle <ArrowUpRight size={17}/></button><button className="text-button" onClick={()=>setEditing(m)} aria-label={`Editar ${m.title}`}>Editar</button><button className="text-button danger-text" onClick={()=>setDeleting(m)} aria-label={`Borrar ${m.title}`}>Borrar</button></div></div>)}</div></main>}
 <footer className="footer page-width"><Brand/><span>Para los que ven más que películas.</span><span className="footer-note">© {new Date().getFullYear()} HeyTomatoes <span>·</span> Diseño de demostración</span></footer>
 {selected&&<MovieDetail key={selected.id} movie={movies.find(m=>m.id===selected.id)||selected} close={()=>setSelected(null)} score={score(movies.find(m=>m.id===selected.id)||selected)} saved={saved.includes(selected.id)} toggleSave={()=>toggleSave(selected.id)} onPublished={()=>{setReload(value=>value+1);setToast('Tu reseña se publicó correctamente')}}/>}
 {adminAuthenticated&&(newMovie||editing)&&<MovieForm movie={editing} close={()=>{setNewMovie(false);setEditing(null)}} onSaved={movie=>{
   setMovies(previous=>{const existing=previous.find(item=>item.id===movie.id);return existing?previous.map(item=>item.id===movie.id?{...movie,score:item.score,votes:item.votes,ratingError:item.ratingError}:item):[movie,...previous]})
   setNewMovie(false);setEditing(null);setReload(value=>value+1);setToast(editing?'Película actualizada':'Película publicada')
 }}/>}
 {adminAuthenticated&&deleting&&<DeleteMovie movie={deleting} close={()=>setDeleting(null)} onDeleted={()=>{
   setMovies(previous=>previous.filter(movie=>movie.id!==deleting.id));setSaved(previous=>previous.filter(id=>id!==deleting.id));setSelected(previous=>previous?.id===deleting.id?null:previous);setDeleting(null);setReload(value=>value+1);setToast('Película eliminada')
 }}/>}
 {toast&&<div className="toast" role="status"><Check size={18}/>{toast}</div>}
 </div>
}
function MovieDetail({movie,close,score,saved,toggleSave,onPublished}){
 const [rating,setRating]=useState(null),[hover,setHover]=useState(null),[text,setText]=useState(''),[error,setError]=useState('')
 const [reviews,setReviews]=useState([]),[loadingReviews,setLoadingReviews]=useState(true),[reviewsError,setReviewsError]=useState(''),[reviewReload,setReviewReload]=useState(0),[submitting,setSubmitting]=useState(false)
 const sending=useRef(false)
 const loadVersion=useRef(0)
 useEffect(()=>{
   const controller=new AbortController()
   const version=++loadVersion.current
   setLoadingReviews(true);setReviewsError('')
   listReviews(movie.id,controller.signal).then(data=>{
     if(!controller.signal.aborted&&version===loadVersion.current)setReviews(data)
   }).catch(error=>{
     if(!controller.signal.aborted&&version===loadVersion.current)setReviewsError(error.message)
   }).finally(()=>{
     if(!controller.signal.aborted&&version===loadVersion.current)setLoadingReviews(false)
   })
   return()=>controller.abort()
 },[movie.id,reviewReload])
 async function submitReview(event){
   event.preventDefault()
   if(sending.current)return
   if(rating===null){setError('Selecciona una calificación de 0 a 5.');return}
   if(!text.trim()){setError('Escribe tu opinión antes de publicar.');return}
   sending.current=true;setSubmitting(true);setError('')
   try {
     const created=await createReview(movie.id,{rating,text})
     ++loadVersion.current
     setReviews(previous=>[...previous.filter(review=>review.id!==created.id),created])
     setRating(null);setText('');setHover(null)
     setReviewReload(value=>value+1)
     onPublished()
   } catch(error){setError(error.message)}
   finally{sending.current=false;setSubmitting(false)}
 }

 return <Modal close={close}><div className="detail-top"><img className="detail-poster" src={img(movie)} alt={`Póster de ${movie.title}`}/><div><div className="eyebrow red-text">LUZ. CÁMARA. TU OPINIÓN.</div><h2>{movie.title}</h2><p className="detail-meta">{movie.year} · {movie.genre} · {movie.duration}</p><div className="detail-score"><Star size={22} fill="currentColor"/>{score}<span>/ 5</span></div><h3>Sinopsis</h3><p className="synopsis">{movie.synopsis}</p><p className="director">Dirección: {movie.director}</p><button className="button secondary" onClick={toggleSave}>{saved?<Check size={16}/>:<Bookmark size={16}/>} {saved?'Guardada en mi lista':'Guardar en mi lista'}</button></div></div><form className="review-form" onSubmit={submitReview}><h3>¿Qué te pareció?</h3><p>Cada opinión cuenta. Comparte la tuya.</p><fieldset className="rating-input" disabled={submitting}><legend className="sr-only">Tu calificación</legend><button type="button" className={`zero-rating ${rating===0?'active':''}`} aria-pressed={rating===0} onClick={()=>setRating(0)}>0</button>{[1,2,3,4,5].map(n=><button key={n} type="button" aria-label={`${n} ${n===1?'estrella':'estrellas'}`} aria-pressed={rating===n} onClick={()=>setRating(n)} onMouseEnter={()=>setHover(n)} onMouseLeave={()=>setHover(null)}><Star size={28} fill={(hover??rating??0)>=n?'currentColor':'none'}/></button>)}<span>{rating===null?'Tu calificación':`${rating} de 5 estrellas`}</span></fieldset><label htmlFor="opinion" className="sr-only">Tu opinión</label><textarea disabled={submitting} id="opinion" maxLength={1200} required rows={4} placeholder="¿Una obra maestra o no era para ti? Cuéntanos, sin spoilers…" value={text} onChange={e=>setText(e.target.value)}/><div className="form-footer"><span>{text.length}/1200</span><button className="button primary" disabled={submitting} type="submit">{submitting?'Publicando…':'Publicar reseña'} <ArrowUpRight size={16}/></button></div>{error&&<p className="form-error" role="alert">{error}</p>}</form><div className="detail-reviews"><h3>La comunidad opina <span>({reviews.length})</span></h3>{loadingReviews&&<p className="muted" role="status">Cargando reseñas…</p>}{reviewsError&&<div role="alert"><p className="form-error">{reviewsError}</p><button className="text-button" onClick={()=>setReviewReload(value=>value+1)}>Reintentar cargar reseñas</button></div>}{reviews.length?reviews.map(r=><div className="detail-review" key={r.id}><div><strong>Opinión de la comunidad · {new Date(r.fechaCreacion).toLocaleDateString('es-CO')}</strong><Stars value={r.calificacion}/></div><p>{r.comentario}</p></div>):!loadingReviews&&!reviewsError&&<p className="muted">Todavía no hay reseñas. ¡Abre la conversación!</p>}</div></Modal>
}
function MovieForm({movie,close,onSaved}){
 const [image,setImage]=useState(movie?.image||''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const sending=useRef(false)
 async function submit(event){
   event.preventDefault()
   if(sending.current)return
   const form=new FormData(event.currentTarget)
   const data={nombre:form.get('nombre').trim(),imagen:image.trim(),sinopsis:form.get('sinopsis').trim(),anioEstreno:Number(form.get('anioEstreno')),genero:form.get('genero').trim(),duracion:Number(form.get('duracion')),director:form.get('director').trim()}
   if(!data.nombre||!data.sinopsis||!data.genero||!data.director){setError('Completa todos los campos con texto válido.');return}
   try{const url=new URL(data.imagen);if(!['http:','https:'].includes(url.protocol))throw new Error()}catch{setError('Usa una URL de imagen que empiece por http:// o https://.');return}
   sending.current=true;setBusy(true);setError('')
   try{const saved=movie?await updateMovie(movie.id,data):await createMovie(data);onSaved(saved)}
   catch(error){setError(error.message)}
   finally{sending.current=false;setBusy(false)}
 }
 return <Modal close={close} busy={busy}><div className="publish-form"><div className="eyebrow red-text">{movie?'EDITAR HISTORIA':'NUEVA HISTORIA'}</div><h2>{movie?'Editar película':'Publicar película'}</h2><p className="muted">Completa los datos que verá la comunidad.</p><form onSubmit={submit}><fieldset className="movie-form-fields" disabled={busy}><label>Nombre<input name="nombre" required maxLength={200} defaultValue={movie?.title||''} placeholder="Nombre de la película"/></label><div className="form-columns"><label>Año de estreno<input name="anioEstreno" type="number" min="1888" max="2100" step="1" defaultValue={movie?.year||new Date().getFullYear()} required/></label><label>Género<input name="genero" required maxLength={100} defaultValue={movie?.genre||''} list="movie-genres" placeholder="Ciencia ficción"/><datalist id="movie-genres">{genres.slice(1).map(genre=><option key={genre} value={genre}/>)}</datalist></label></div><div className="form-columns"><label>Duración (minutos)<input name="duracion" type="number" min="1" max="10000" step="1" defaultValue={movie?.durationMinutes||''} required/></label><label>Director<input name="director" maxLength={200} defaultValue={movie?.director||''} required/></label></div><label>URL de la imagen<input type="url" name="imagen" maxLength={2048} required value={image} onChange={event=>setImage(event.target.value)} placeholder="https://ejemplo.com/poster.jpg"/></label><label>Sinopsis<textarea name="sinopsis" rows={4} maxLength={10000} defaultValue={movie?.synopsis||''} required placeholder="¿De qué trata la película?"/></label><div className="form-footer"><button className="button secondary" type="button" onClick={close}>Cancelar</button><button className="button primary" type="submit">{busy?'Guardando…':movie?'Guardar cambios':'Publicar película'}</button></div></fieldset>{error&&<p role="alert" className="form-error">{error}</p>}</form></div></Modal>
}
function DeleteMovie({movie,close,onDeleted}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const sending=useRef(false)
 async function remove(){
   if(sending.current)return
   sending.current=true;setBusy(true);setError('')
   try{await deleteMovie(movie.id);onDeleted()}catch(error){setError(error.message)}finally{sending.current=false;setBusy(false)}
 }
 return <Modal close={close} busy={busy}><div className="publish-form"><div className="eyebrow red-text">BORRAR PELÍCULA</div><h2>¿Borrar «{movie.title}»?</h2><p className="muted">También se eliminarán sus calificaciones y comentarios. Esta acción no se puede deshacer.</p>{error&&<p role="alert" className="form-error">{error}</p>}<div className="form-footer"><button className="button secondary" disabled={busy} onClick={close}>Cancelar</button><button className="button primary" disabled={busy} onClick={remove}>{busy?'Borrando…':'Sí, borrar película'}</button></div></div></Modal>
}

function AdminLogin({onLogin}) {
 const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const sending=useRef(false)
 async function submit(event){
   event.preventDefault();if(sending.current)return
   sending.current=true;setBusy(true);setError('')
   try{await loginAdmin(token.trim());setToken('');onLogin()}
   catch(error){setError(error instanceof TypeError?'No se pudo conectar con la API. Inténtalo de nuevo.':error.message)}
   finally{sending.current=false;setBusy(false)}
 }
 return <main className="page-width admin-page"><div className="admin-login publish-form"><div className="eyebrow red-text">ACCESO PRIVADO</div><h2>Administración</h2><p className="muted">Ingresa tu token para gestionar las películas.</p><form onSubmit={submit}><label>Token de administración<input type="password" name="admin-token" autoComplete="off" spellCheck={false} autoCapitalize="none" required value={token} disabled={busy} onChange={event=>setToken(event.target.value)}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy||!token.trim()} type="submit">{busy?'Verificando…':'Entrar al panel'}</button></form></div></main>
}
