/* general login stuff */

export { initUser }

import { toggleBox } from './utils.js'

function initUser() {
    toggleBox(false, '#toggle_ll', '#locallogin');
}
