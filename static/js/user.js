/* general login stuff */

export { initUser }

import { initToggleBox } from './utils.js'

function initUser() {
    initToggleBox('#toggle_ll', '#locallogin');
}
