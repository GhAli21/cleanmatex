Update sys_tenant_settings_cd 
Set is_active=FALSE
   , rec_status=0
Where setting_code in ('INV_PDF_ENABLED', 'PRN_THERMAL_ENABLED', 'RCPT_WHATSAPP_ENABLED')
;
commit;