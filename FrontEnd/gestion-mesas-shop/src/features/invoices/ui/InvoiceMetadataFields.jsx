export default function InvoiceMetadataFields({ value, onChange, suppliers, disabled = false }) {
  return <fieldset className="invoice-metadata" disabled={disabled}><legend>Datos de la factura</legend>
    <label>Proveedor <span aria-hidden="true">*</span><select required value={value.supplierId} onChange={(event) => onChange({ ...value, supplierId: event.target.value })}><option value="">Seleccionar proveedor</option>{suppliers.filter((s) => s.isActive || s.id === Number(value.supplierId)).map((s) => <option key={s.id} value={s.id}>{s.name}{s.isActive ? '' : ' (inactivo)'}</option>)}</select></label>
    <div className="invoice-field-row"><label>Fecha de la factura <span aria-hidden="true">*</span><input required type="date" min="1900-01-01" value={value.issueDate} onChange={(event) => onChange({ ...value, issueDate: event.target.value })} /></label><label>Número o referencia<input maxLength={100} placeholder="Ej.: A 0001-00012345" value={value.reference} onChange={(event) => onChange({ ...value, reference: event.target.value })} /></label></div>
    <label>Observaciones <small>Opcional</small><textarea rows="2" maxLength={1000} placeholder="Notas para identificar este documento" value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} /></label>
  </fieldset>
}
