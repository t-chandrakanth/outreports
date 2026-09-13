import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import LanguageIcon from '@mui/icons-material/Language';
import { useTranslation } from 'react-i18next';
import { currentLanguage, LANGUAGES, setLanguage, type LanguageCode } from '../i18n';
import { useBackClose } from '../nav/NavContext';

/**
 * App-bar language switcher: globe icon with a visible caption so it is
 * recognisable. Each option is labelled in its own script.
 */
export function LanguageMenu() {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = anchor !== null;
  const close = () => setAnchor(null);
  const current = currentLanguage();

  // Hardware back closes the menu instead of leaving the screen.
  useBackClose(open, close);

  function choose(code: LanguageCode) {
    close();
    if (code !== current) void setLanguage(code);
  }

  return (
    <>
      <IconButton
        color="inherit"
        aria-label={t('language.change')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ flexDirection: 'column', gap: 0.25, px: 1, py: 0.5, borderRadius: 2 }}
      >
        <LanguageIcon fontSize="small" />
        <Typography component="span" sx={{ fontSize: '0.65rem', lineHeight: 1, fontWeight: 600 }}>
          {t('language.label')}
        </Typography>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={open}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {LANGUAGES.map((lang) => {
          const selected = lang.code === current;
          return (
            <MenuItem
              key={lang.code}
              lang={lang.code}
              selected={selected}
              aria-current={selected ? 'true' : undefined}
              onClick={() => choose(lang.code)}
              sx={{ minHeight: 48 }}
            >
              <ListItemIcon>{selected && <CheckIcon fontSize="small" />}</ListItemIcon>
              <ListItemText>{lang.name}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
